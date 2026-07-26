import type { SupabaseClient } from "@supabase/supabase-js";
import { SpeakerRequest, SpeakerRequestStatus } from "@/types";

const SPEAKER_REQUEST_SELECT = "id, name, email, phone, church_affiliation, church_id, topic, bio, message, headshot_url, status, created_at, updated_at, church:churches(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSpeakerRequest(row: any): SpeakerRequest {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    churchAffiliation: row.church_affiliation,
    churchId: row.church_id,
    churchName: row.church?.name ?? null,
    topic: row.topic,
    bio: row.bio,
    message: row.message,
    headshotUrl: row.headshot_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSpeakerRequestInput {
  name: string;
  email: string;
  phone: string;
  churchAffiliation: string;
  churchId: string | null;
  topic: string;
  bio: string;
  message: string;
  headshotUrl: string;
}

// Reachable by a prospective speaker who has no account at all -- speaker_requests_insert_anyone
// (supabase/migrations/0038_campaign_lessons.sql) grants insert to anon as well as authenticated,
// unlike lesson_requests' sign-in-required equivalent.
export async function createSpeakerRequest(supabase: SupabaseClient, input: CreateSpeakerRequestInput): Promise<void> {
  const { error } = await supabase.from("speaker_requests").insert({
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim() || null,
    church_affiliation: input.churchAffiliation.trim() || null,
    church_id: input.churchId,
    topic: input.topic.trim() || null,
    bio: input.bio.trim() || null,
    message: input.message.trim() || null,
    headshot_url: input.headshotUrl.trim() || null,
  });
  if (error) throw error;
}

// Admin-only read (speaker_requests_select_admin) -- a prospective speaker has no self-service
// "my request" view, since most have no account to scope one to.
export async function getSpeakerRequestsForAdmin(supabase: SupabaseClient): Promise<SpeakerRequest[]> {
  const { data, error } = await supabase
    .from("speaker_requests")
    .select(SPEAKER_REQUEST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSpeakerRequest);
}

export async function updateSpeakerRequestStatus(
  supabase: SupabaseClient,
  requestId: string,
  status: SpeakerRequestStatus
): Promise<void> {
  const { error } = await supabase.from("speaker_requests").update({ status }).eq("id", requestId);
  if (error) throw error;
}
