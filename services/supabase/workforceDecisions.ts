import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WorkforceDecision,
  WorkforceDecisionParticipant,
  WorkforceDecisionInvitationRequest,
  WorkforceDecisionPriority,
  WorkforceDecisionSecurity,
  WorkforceInvitationTargetScope,
  WorkforceRole,
} from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDecision(row: any, namesById: Map<string, string>, participantCountById: Map<string, number>): WorkforceDecision {
  return {
    id: row.id,
    churchId: row.church_id,
    decisionNumber: row.decision_number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    security: row.security,
    departmentId: row.department_id,
    controllingStakeholderGroup: row.controlling_stakeholder_group,
    decisionOwner: row.decision_owner,
    decisionOwnerName: row.decision_owner ? (namesById.get(row.decision_owner) ?? null) : null,
    executiveIntent: row.executive_intent,
    desiredOutcome: row.desired_outcome,
    targetDate: row.target_date,
    createdBy: row.created_by,
    createdByName: row.created_by ? (namesById.get(row.created_by) ?? null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participantCount: participantCountById.get(row.id) ?? 0,
  };
}

// Batches the two supporting lookups (owner/creator display names, participant counts) that would
// otherwise require a PostgREST embed per row -- wf_decisions has two separate FKs into profiles
// (decision_owner, created_by), which makes an ambiguous embed without an explicit constraint-name
// hint; two flat queries plus in-memory maps are simpler and avoid depending on a constraint name.
// One shared id->name map covers both columns, since a profile's name doesn't depend on which role
// it's being looked up for.
async function hydrateDecisions(supabase: SupabaseClient, rows: { id: string; decision_owner: string | null; created_by: string | null }[]) {
  const nameIds = Array.from(new Set([...rows.map((r) => r.decision_owner), ...rows.map((r) => r.created_by)].filter((id): id is string => !!id)));
  const decisionIds = rows.map((r) => r.id);

  const [{ data: profiles, error: profilesError }, { data: participants, error: participantsError }] = await Promise.all([
    nameIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", nameIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    decisionIds.length > 0
      ? supabase.from("wf_decision_participants").select("decision_id").in("decision_id", decisionIds)
      : Promise.resolve({ data: [] as { decision_id: string }[], error: null }),
  ]);
  if (profilesError) throw profilesError;
  if (participantsError) throw participantsError;

  const namesById = new Map((profiles ?? []).map((o) => [o.id, o.full_name ?? "Unnamed"]));
  const participantCountById = new Map<string, number>();
  (participants ?? []).forEach((p) => participantCountById.set(p.decision_id, (participantCountById.get(p.decision_id) ?? 0) + 1));

  return { ownerNamesById: namesById, participantCountById };
}

export interface DecisionFilters {
  status?: string;
  priority?: string;
  security?: string;
  departmentId?: string;
  search?: string;
  mine?: boolean; // created_by = current profile
  assignedToMe?: boolean; // profile is a participant
}

export async function listDecisions(supabase: SupabaseClient, churchId: string, filters: DecisionFilters = {}): Promise<WorkforceDecision[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from("wf_decisions").select("*").eq("church_id", churchId).order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.security) query = query.eq("security", filters.security);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,decision_number.ilike.%${filters.search}%`);
  if (filters.mine && user) query = query.eq("created_by", user.id);

  const { data, error } = await query;
  if (error) throw error;
  let rows = data ?? [];

  // assignedToMe filters client-side after an extra participant lookup -- RLS already limits rows
  // to what this profile can see at all, so this is just a display filter on top of that set.
  if (filters.assignedToMe && user) {
    const { data: myParticipation, error: participationError } = await supabase
      .from("wf_decision_participants")
      .select("decision_id")
      .eq("profile_id", user.id);
    if (participationError) throw participationError;
    const myDecisionIds = new Set((myParticipation ?? []).map((p) => p.decision_id));
    rows = rows.filter((r) => myDecisionIds.has(r.id));
  }

  const { ownerNamesById, participantCountById } = await hydrateDecisions(supabase, rows);
  return rows.map((r) => mapDecision(r, ownerNamesById, participantCountById));
}

export async function getDecision(supabase: SupabaseClient, decisionId: string): Promise<WorkforceDecision | null> {
  const { data, error } = await supabase.from("wf_decisions").select("*").eq("id", decisionId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { ownerNamesById, participantCountById } = await hydrateDecisions(supabase, [data]);
  return mapDecision(data, ownerNamesById, participantCountById);
}

export interface CreateDecisionInput {
  churchId: string;
  title: string;
  priority: WorkforceDecisionPriority;
  security: WorkforceDecisionSecurity;
  departmentId: string | null;
  controllingStakeholderGroup: string;
  decisionOwner: string | null;
  executiveIntent: string;
  desiredOutcome: string;
  targetDate: string | null;
}

// Allocates the human-readable decision number server-side (wf_allocate_decision_number,
// SECURITY DEFINER, migration 0045) before inserting, rather than letting the client compute one --
// the function is also this feature's real authorization check (manager or org-wide stakeholder),
// so a request that isn't entitled fails at that step, before any row is ever written.
export async function createDecision(supabase: SupabaseClient, input: CreateDecisionInput): Promise<WorkforceDecision> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to create a decision.");

  const { data: decisionNumber, error: allocError } = await supabase.rpc("wf_allocate_decision_number", { p_church_id: input.churchId });
  if (allocError) throw allocError;

  const { data, error } = await supabase
    .from("wf_decisions")
    .insert({
      church_id: input.churchId,
      decision_number: decisionNumber,
      title: input.title.trim(),
      priority: input.priority,
      security: input.security,
      department_id: input.departmentId,
      controlling_stakeholder_group: input.controllingStakeholderGroup.trim() || null,
      decision_owner: input.decisionOwner,
      executive_intent: input.executiveIntent.trim() || null,
      desired_outcome: input.desiredOutcome.trim() || null,
      target_date: input.targetDate,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { ownerNamesById, participantCountById } = await hydrateDecisions(supabase, [data]);
  return mapDecision(data, ownerNamesById, participantCountById);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapParticipant(row: any, nameById: Map<string, string>): WorkforceDecisionParticipant {
  return {
    id: row.id,
    decisionId: row.decision_id,
    profileId: row.profile_id,
    profileName: nameById.get(row.profile_id) ?? null,
    profileAvatarUrl: null,
    role: row.role as WorkforceRole,
    addedBy: row.added_by,
    createdAt: row.created_at,
  };
}

export async function getDecisionParticipants(supabase: SupabaseClient, decisionId: string): Promise<WorkforceDecisionParticipant[]> {
  const { data, error } = await supabase.from("wf_decision_participants").select("*").eq("decision_id", decisionId).order("created_at");
  if (error) throw error;
  const rows = data ?? [];

  const profileIds = Array.from(new Set(rows.map((r) => r.profile_id)));
  const { data: profiles, error: profilesError } =
    profileIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", profileIds) : { data: [], error: null };
  if (profilesError) throw profilesError;
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed"]));

  return rows.map((r) => mapParticipant(r, nameById));
}

// "Track This Decision" (WF-02 primary action). Adds the current profile as a participant using
// their most relevant existing Workforce role in this org (org-wide role if any, else whichever
// department-scoped role they hold in the decision's own department, else falls back to
// `employee` -- being allowed to see the decision at all via RLS implies some standing, so this is
// a reasonable default rather than a real guess). A repeat call is a harmless no-op via the
// unique(decision_id, profile_id, role) constraint.
export async function trackDecision(supabase: SupabaseClient, decision: WorkforceDecision): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to track a decision.");

  const { data: myRoles, error: rolesError } = await supabase
    .from("wf_role_assignments")
    .select("role, department_id")
    .eq("church_id", decision.churchId)
    .eq("profile_id", user.id);
  if (rolesError) throw rolesError;

  const orgWide = (myRoles ?? []).find((r) => r.department_id === null);
  const inDepartment = (myRoles ?? []).find((r) => r.department_id === decision.departmentId);
  const role = orgWide?.role ?? inDepartment?.role ?? "employee";

  const { error } = await supabase
    .from("wf_decision_participants")
    .upsert({ decision_id: decision.id, profile_id: user.id, role, added_by: user.id }, { onConflict: "decision_id,profile_id,role" });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvitationRequest(row: any): WorkforceDecisionInvitationRequest {
  return {
    id: row.id,
    decisionId: row.decision_id,
    churchId: row.church_id,
    targetScope: row.target_scope,
    departmentId: row.department_id,
    targetProfileId: row.target_profile_id,
    status: row.status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function listInvitationRequests(supabase: SupabaseClient, decisionId: string): Promise<WorkforceDecisionInvitationRequest[]> {
  const { data, error } = await supabase
    .from("wf_decision_invitation_requests")
    .select("*")
    .eq("decision_id", decisionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInvitationRequest);
}

// Backs the "Request a Specific Person" picker -- scoped to this org's own church_memberships so
// a manager can only look up people who actually belong to their org, never a platform-wide email
// search (profiles_select_managed_church_members, 0012, already bounds this the same way).
export async function findOrgMemberByEmail(
  supabase: SupabaseClient,
  churchId: string,
  email: string
): Promise<{ id: string; fullName: string | null; email: string } | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("church_memberships")
    .select("profile:profiles!inner(id, full_name, email)")
    .eq("church_id", churchId)
    .ilike("profile.email", email.trim())
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.profile) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = membership.profile as any;
  return { id: profile.id, fullName: profile.full_name, email: profile.email };
}

export interface CreateInvitationRequestInput {
  decisionId: string;
  churchId: string;
  targetScope: WorkforceInvitationTargetScope;
  departmentId?: string | null;
  targetProfileId?: string | null;
}

export async function createInvitationRequest(
  supabase: SupabaseClient,
  input: CreateInvitationRequestInput
): Promise<WorkforceDecisionInvitationRequest> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to send an invitation request.");

  const { data, error } = await supabase
    .from("wf_decision_invitation_requests")
    .insert({
      decision_id: input.decisionId,
      church_id: input.churchId,
      target_scope: input.targetScope,
      department_id: input.departmentId ?? null,
      target_profile_id: input.targetProfileId ?? null,
      requested_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapInvitationRequest(data);
}

// Approve/decline (org managers only in this phase -- see migration 0045's file header). Approving
// a department/department_leadership request also adds every current member of that department
// who holds the matching wf_role_assignments role as a decision participant -- the practical
// meaning of "the department is now on this decision." Approving a specific_person request adds
// just that one profile.
export async function reviewInvitationRequest(
  supabase: SupabaseClient,
  request: WorkforceDecisionInvitationRequest,
  approve: boolean
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to review an invitation request.");

  const { error: updateError } = await supabase
    .from("wf_decision_invitation_requests")
    .update({ status: approve ? "approved" : "declined", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", request.id);
  if (updateError) throw updateError;

  if (!approve) return;

  if (request.targetScope === "specific_person" && request.targetProfileId) {
    const { error } = await supabase
      .from("wf_decision_participants")
      .upsert(
        { decision_id: request.decisionId, profile_id: request.targetProfileId, role: "employee", added_by: user.id },
        { onConflict: "decision_id,profile_id,role" }
      );
    if (error) throw error;
    return;
  }

  if (request.departmentId) {
    const targetRole: WorkforceRole = request.targetScope === "department_leadership" ? "department_leadership" : "employee";
    const { data: members, error: membersError } = await supabase
      .from("wf_role_assignments")
      .select("profile_id")
      .eq("department_id", request.departmentId)
      .eq("role", targetRole);
    if (membersError) throw membersError;

    const rows = (members ?? []).map((m) => ({
      decision_id: request.decisionId,
      profile_id: m.profile_id,
      role: targetRole,
      added_by: user.id,
    }));
    if (rows.length === 0) return;

    const { error } = await supabase.from("wf_decision_participants").upsert(rows, { onConflict: "decision_id,profile_id,role" });
    if (error) throw error;
  }
}
