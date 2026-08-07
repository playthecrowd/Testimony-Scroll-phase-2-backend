import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkforceExperienceTemplate, WorkforceExperienceAssignment } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(row: any): WorkforceExperienceTemplate {
  return {
    id: row.id,
    capabilityKey: row.capability_key,
    title: row.title,
    communicationFocus: row.communication_focus,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

// Platform-wide catalog (spec section 9's 8 attraction capabilities / Future Factory use cases),
// seeded once in migration 0046 -- same 8 rows for every org, no org filter needed.
export async function listExperienceTemplates(supabase: SupabaseClient): Promise<WorkforceExperienceTemplate[]> {
  const { data, error } = await supabase.from("wf_experience_templates").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map(mapTemplate);
}

export async function listExperienceAssignments(supabase: SupabaseClient, decisionId: string): Promise<WorkforceExperienceAssignment[]> {
  const [{ data: assignments, error: assignmentsError }, { data: templates, error: templatesError }] = await Promise.all([
    supabase.from("wf_experience_assignments").select("*").eq("decision_id", decisionId).order("created_at"),
    supabase.from("wf_experience_templates").select("*"),
  ]);
  if (assignmentsError) throw assignmentsError;
  if (templatesError) throw templatesError;

  const rows = assignments ?? [];
  const templateById = new Map((templates ?? []).map((t) => [t.id, mapTemplate(t)]));

  const assignmentIds = rows.map((r) => r.id);
  const { data: managerRows, error: managerError } =
    assignmentIds.length > 0
      ? await supabase.from("wf_experience_assignment_managers").select("assignment_id, profile_id").in("assignment_id", assignmentIds)
      : { data: [] as { assignment_id: string; profile_id: string }[], error: null };
  if (managerError) throw managerError;

  const managerProfileIds = Array.from(new Set((managerRows ?? []).map((m) => m.profile_id)));
  const { data: profiles, error: profilesError } =
    managerProfileIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", managerProfileIds) : { data: [], error: null };
  if (profilesError) throw profilesError;
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed"]));

  return rows.map((r) => ({
    id: r.id,
    decisionId: r.decision_id,
    experienceTemplateId: r.experience_template_id,
    template: templateById.get(r.experience_template_id) ?? null,
    customizationNotes: r.customization_notes,
    assignedBy: r.assigned_by,
    createdAt: r.created_at,
    managers: (managerRows ?? [])
      .filter((m) => m.assignment_id === r.id)
      .map((m) => ({ profileId: m.profile_id, profileName: nameById.get(m.profile_id) ?? null })),
  }));
}

// "Select & Assign" (WF-04). customizationNotes folds in the spec's separate "Customize with
// Plotabl" action -- see migration 0046's file header on why this isn't a second record type.
export async function assignExperience(
  supabase: SupabaseClient,
  decisionId: string,
  experienceTemplateId: string,
  customizationNotes: string
): Promise<WorkforceExperienceAssignment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to assign an experience.");

  const { data, error } = await supabase
    .from("wf_experience_assignments")
    .insert({
      decision_id: decisionId,
      experience_template_id: experienceTemplateId,
      customization_notes: customizationNotes.trim() || null,
      assigned_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;

  return { id: data.id, decisionId: data.decision_id, experienceTemplateId: data.experience_template_id, template: null, customizationNotes: data.customization_notes, assignedBy: data.assigned_by, createdAt: data.created_at, managers: [] };
}

export async function removeExperienceAssignment(supabase: SupabaseClient, assignmentId: string): Promise<void> {
  const { error } = await supabase.from("wf_experience_assignments").delete().eq("id", assignmentId);
  if (error) throw error;
}

// Department Leadership "assigns managers" to a selected experience -- pulled from the decision's
// own department's `manager`-role wf_role_assignments holders (the picker service call).
export async function assignExperienceManager(supabase: SupabaseClient, assignmentId: string, profileId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to assign a manager.");

  const { error } = await supabase
    .from("wf_experience_assignment_managers")
    .upsert({ assignment_id: assignmentId, profile_id: profileId, assigned_by: user.id }, { onConflict: "assignment_id,profile_id" });
  if (error) throw error;
}

export async function removeExperienceAssignmentManager(supabase: SupabaseClient, assignmentId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("wf_experience_assignment_managers")
    .delete()
    .eq("assignment_id", assignmentId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

// Managers available to assign for a decision's own department (wf_role_assignments role =
// 'manager', scoped to that department) -- the picker's candidate list.
export async function listDepartmentManagers(
  supabase: SupabaseClient,
  churchId: string,
  departmentId: string
): Promise<{ profileId: string; profileName: string | null }[]> {
  const { data: roleRows, error: roleError } = await supabase
    .from("wf_role_assignments")
    .select("profile_id")
    .eq("church_id", churchId)
    .eq("department_id", departmentId)
    .eq("role", "manager");
  if (roleError) throw roleError;

  const profileIds = Array.from(new Set((roleRows ?? []).map((r) => r.profile_id)));
  if (profileIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
  if (profilesError) throw profilesError;

  return (profiles ?? []).map((p) => ({ profileId: p.id, profileName: p.full_name ?? null }));
}
