import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WorkforceDecision,
  WorkforceDecisionStage,
  WorkforceDecisionStageTransition,
  WorkforceDecisionFeedback,
  WorkforceStageKey,
} from "@/types";

// The 7-stage Pathway, in order -- see migration 0046's file header for why these are the same
// strings as 7 of WorkforceDecisionStatus's 11 values.
export const STAGE_ORDER: WorkforceStageKey[] = [
  "stakeholder_review",
  "awaiting_leadership_approval",
  "department_translation",
  "management_planning",
  "employee_activation",
  "in_implementation",
  "measuring_outcomes",
];

export const STAGE_LABELS: Record<WorkforceStageKey, string> = {
  stakeholder_review: "Stakeholder Intent",
  awaiting_leadership_approval: "Leadership Approval",
  department_translation: "Department Translation",
  management_planning: "Management Planning",
  employee_activation: "Employee Activation",
  in_implementation: "Implementation",
  measuring_outcomes: "Outcomes & Lessons",
};

async function hydrateProfileNames(supabase: SupabaseClient, profileIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(profileIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "Unnamed"]));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStage(row: any, ownerNamesById: Map<string, string>): WorkforceDecisionStage {
  return {
    id: row.id,
    decisionId: row.decision_id,
    stageKey: row.stage_key,
    sortOrder: row.sort_order,
    status: row.status,
    ownerProfileId: row.owner_profile_id,
    ownerName: row.owner_profile_id ? (ownerNamesById.get(row.owner_profile_id) ?? null) : null,
    objective: row.objective,
    deliverables: row.deliverables,
    dueDate: row.due_date,
    requiresApproval: row.requires_approval,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function statusForStageAt(index: number, currentIndex: number): "not_started" | "in_progress" | "complete" {
  if (currentIndex < 0) return "not_started"; // decision hasn't entered the pathway yet (still draft)
  if (index < currentIndex) return "complete";
  if (index === currentIndex) return "in_progress";
  return "not_started";
}

// Lazily creates (or brings up to date) all 7 stage rows for a decision, derived from its current
// flat `status` -- called whenever the Workspace page loads rather than at decision-creation time,
// so a decision created before this phase shipped still gets correct stage rows on first view.
// Upsert only touches `status`/`started_at`/`completed_at`/`requires_approval` -- never
// objective/deliverables/owner, which are edited independently and must survive repeated calls.
export async function ensureDecisionStages(supabase: SupabaseClient, decision: WorkforceDecision): Promise<void> {
  const currentIndex = STAGE_ORDER.indexOf(decision.status as WorkforceStageKey);

  const { data: existing, error: existingError } = await supabase
    .from("wf_decision_stages")
    .select("stage_key")
    .eq("decision_id", decision.id);
  if (existingError) throw existingError;
  const existingKeys = new Set((existing ?? []).map((r) => r.stage_key));

  const now = new Date().toISOString();
  const missing = STAGE_ORDER.map((stageKey, index) => ({ stageKey, index })).filter(({ stageKey }) => !existingKeys.has(stageKey));
  if (missing.length > 0) {
    const rows = missing.map(({ stageKey, index }) => ({
      decision_id: decision.id,
      stage_key: stageKey,
      sort_order: index,
      status: statusForStageAt(index, currentIndex),
      requires_approval: stageKey === "awaiting_leadership_approval",
      started_at: index <= currentIndex ? now : null,
      completed_at: index < currentIndex ? now : null,
    }));
    const { error } = await supabase.from("wf_decision_stages").insert(rows);
    if (error) throw error;
  }
}

export async function listDecisionStages(supabase: SupabaseClient, decisionId: string): Promise<WorkforceDecisionStage[]> {
  const { data, error } = await supabase.from("wf_decision_stages").select("*").eq("decision_id", decisionId).order("sort_order");
  if (error) throw error;
  const rows = data ?? [];
  const ownerNamesById = await hydrateProfileNames(supabase, rows.map((r) => r.owner_profile_id));
  return rows.map((r) => mapStage(r, ownerNamesById));
}

// "Advance" (WF-03's "Open Stage Workspace" / implicit stage-completion action). Moves the
// decision from its current pathway position to the next one: draft -> first stage, a completed
// stage -> the next stage in_progress, or the last stage -> the decision itself marked
// `completed`. Refuses to advance past a stage with requires_approval set until it has been
// approved (wf_approve_decision_stage) -- the one place in this phase's pathway with a real gate.
export async function advanceDecisionStage(
  supabase: SupabaseClient,
  decision: WorkforceDecision,
  stages: WorkforceDecisionStage[]
): Promise<{ decisionStatus: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to advance this decision.");

  const currentIndex = STAGE_ORDER.indexOf(decision.status as WorkforceStageKey);
  const currentStage = currentIndex >= 0 ? stages.find((s) => s.stageKey === STAGE_ORDER[currentIndex]) : null;

  if (currentStage?.requiresApproval && !currentStage.approvedAt) {
    throw new Error("This proposal must be approved by the decision's authorized leadership before participants are invited.");
  }

  const nextIndex = currentIndex + 1;
  const now = new Date().toISOString();

  if (currentStage) {
    const { error } = await supabase
      .from("wf_decision_stages")
      .update({ status: "complete", completed_at: now })
      .eq("id", currentStage.id);
    if (error) throw error;
  }

  if (nextIndex >= STAGE_ORDER.length) {
    const { error } = await supabase.from("wf_decisions").update({ status: "completed" }).eq("id", decision.id);
    if (error) throw error;
    await supabase
      .from("wf_decision_stage_transitions")
      .insert({ decision_id: decision.id, from_stage_key: currentStage?.stageKey ?? null, to_stage_key: "measuring_outcomes", changed_by: user.id, note: "Decision completed" });
    return { decisionStatus: "completed" };
  }

  const nextStageKey = STAGE_ORDER[nextIndex];
  const nextStage = stages.find((s) => s.stageKey === nextStageKey);

  const { error: decisionError } = await supabase.from("wf_decisions").update({ status: nextStageKey }).eq("id", decision.id);
  if (decisionError) throw decisionError;

  if (nextStage) {
    const { error } = await supabase.from("wf_decision_stages").update({ status: "in_progress", started_at: now }).eq("id", nextStage.id);
    if (error) throw error;
  }

  const { error: transitionError } = await supabase
    .from("wf_decision_stage_transitions")
    .insert({ decision_id: decision.id, from_stage_key: currentStage?.stageKey ?? null, to_stage_key: nextStageKey, changed_by: user.id });
  if (transitionError) throw transitionError;

  return { decisionStatus: nextStageKey };
}

export async function approveStage(supabase: SupabaseClient, stageId: string): Promise<void> {
  const { error } = await supabase.rpc("wf_approve_decision_stage", { p_stage_id: stageId });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransition(row: any, namesById: Map<string, string>): WorkforceDecisionStageTransition {
  return {
    id: row.id,
    decisionId: row.decision_id,
    fromStageKey: row.from_stage_key,
    toStageKey: row.to_stage_key,
    changedBy: row.changed_by,
    changedByName: row.changed_by ? (namesById.get(row.changed_by) ?? null) : null,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function listStageTransitions(supabase: SupabaseClient, decisionId: string): Promise<WorkforceDecisionStageTransition[]> {
  const { data, error } = await supabase
    .from("wf_decision_stage_transitions")
    .select("*")
    .eq("decision_id", decisionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const namesById = await hydrateProfileNames(supabase, rows.map((r) => r.changed_by));
  return rows.map((r) => mapTransition(r, namesById));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeedback(row: any, namesById: Map<string, string>): WorkforceDecisionFeedback {
  return {
    id: row.id,
    decisionId: row.decision_id,
    stageKey: row.stage_key,
    authorProfileId: row.author_profile_id,
    authorName: row.author_profile_id ? (namesById.get(row.author_profile_id) ?? null) : null,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listDecisionFeedback(supabase: SupabaseClient, decisionId: string): Promise<WorkforceDecisionFeedback[]> {
  const { data, error } = await supabase
    .from("wf_decision_feedback")
    .select("*")
    .eq("decision_id", decisionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const namesById = await hydrateProfileNames(supabase, rows.map((r) => r.author_profile_id));
  return rows.map((r) => mapFeedback(r, namesById));
}

export async function addDecisionFeedback(
  supabase: SupabaseClient,
  decisionId: string,
  body: string,
  stageKey: WorkforceStageKey | null
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to leave feedback.");

  const { error } = await supabase
    .from("wf_decision_feedback")
    .insert({ decision_id: decisionId, stage_key: stageKey, author_profile_id: user.id, body: body.trim() });
  if (error) throw error;
}
