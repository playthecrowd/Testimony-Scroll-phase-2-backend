import type { SupabaseClient } from "@supabase/supabase-js";
import { LessonRequest, LessonRequestScope, LessonRequestStatus } from "@/types";

const REQUEST_SELECT = "id, topic, notes, scope, church_id, status, created_at, updated_at, church:churches(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRequest(row: any): LessonRequest {
  return {
    id: row.id,
    topic: row.topic,
    notes: row.notes,
    scope: row.scope,
    churchId: row.church_id,
    churchName: row.church?.name ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateLessonRequestInput {
  topic: string;
  notes: string;
  scope: LessonRequestScope;
  churchId: string | null;
}

// RLS (lesson_requests_insert_own) requires requested_by = auth.uid() and status = 'submitted' --
// both set explicitly here rather than relying on a column default, matching how self-service
// inserts elsewhere in this codebase (e.g. joinChurchAsMember) already work.
export async function createLessonRequest(supabase: SupabaseClient, input: CreateLessonRequestInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to request a lesson.");

  const { error } = await supabase.from("lesson_requests").insert({
    requested_by: user.id,
    topic: input.topic,
    notes: input.notes || null,
    scope: input.scope,
    church_id: input.scope === "church" ? input.churchId : null,
    status: "submitted",
  });
  if (error) throw error;
}

export async function getMyLessonRequests(supabase: SupabaseClient): Promise<LessonRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lesson_requests")
    .select(REQUEST_SELECT)
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRequest);
}

// Host-facing: directed requests for a church the caller manages (RLS: lesson_requests_select_managed).
export async function getChurchLessonRequests(supabase: SupabaseClient, churchId: string): Promise<LessonRequest[]> {
  const { data, error } = await supabase
    .from("lesson_requests")
    .select(REQUEST_SELECT)
    .eq("church_id", churchId)
    .eq("scope", "church")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRequest);
}

// Admin-facing: public requests still awaiting a moderation decision (RLS: only a platform admin
// can see these before they're approved).
export async function getPendingPublicLessonRequests(supabase: SupabaseClient): Promise<LessonRequest[]> {
  const { data, error } = await supabase
    .from("lesson_requests")
    .select(REQUEST_SELECT)
    .eq("scope", "public")
    .in("status", ["submitted", "under_review"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRequest);
}

// Public-facing: approved public requests, visible to anyone (RLS: lesson_requests_select_public_approved).
export async function getApprovedPublicLessonRequests(supabase: SupabaseClient): Promise<LessonRequest[]> {
  const { data, error } = await supabase
    .from("lesson_requests")
    .select(REQUEST_SELECT)
    .eq("scope", "public")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRequest);
}

export async function updateLessonRequestStatus(
  supabase: SupabaseClient,
  requestId: string,
  status: LessonRequestStatus
): Promise<void> {
  const { error } = await supabase.from("lesson_requests").update({ status }).eq("id", requestId);
  if (error) throw error;
}
