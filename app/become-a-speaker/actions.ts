"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { createSpeakerRequest, CreateSpeakerRequestInput } from "@/services/supabase/speakerRequests";

export interface SubmitSpeakerRequestResult {
  error?: string;
  ok?: boolean;
}

// Deliberately no sign-in check -- a prospective speaker who has never used this platform must be
// able to submit this form (speaker_requests_insert_anyone grants insert to anon too; see
// supabase/migrations/0038_campaign_lessons.sql).
export async function submitSpeakerRequestAction(input: CreateSpeakerRequestInput): Promise<SubmitSpeakerRequestResult> {
  if (!input.name.trim()) return { error: "Your name is required." };
  if (!input.email.trim()) return { error: "Your email is required." };

  try {
    const supabase = await createClient();
    await createSpeakerRequest(supabase, input);
    return { ok: true };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[submitSpeakerRequestAction] Unexpected error:", err);
    return { error: "Something went wrong submitting your request. Please try again." };
  }
}
