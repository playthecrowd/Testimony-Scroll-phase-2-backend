"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { registerForOccurrence, cancelRegistration } from "@/services/supabase/churchExperiences";
import { ChurchExperienceRegistration } from "@/types";

// Member-facing registration/cancellation actions (Phase 10.3, checkpoint 5). Both are thin
// wrappers around the Phase 10.1 SECURITY DEFINER RPCs -- there is no direct client insert/update
// into church_experience_registrations anywhere in this app; the RPC is the only path, exactly
// matching the RLS design (no INSERT grant exists on that table at all).

export interface ExperienceActionResult {
  error?: string;
  ok?: boolean;
  registration?: ChurchExperienceRegistration;
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof SupabaseConfigError) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    const message = (err as { message: string }).message;
    // Our own RPCs' RAISE EXCEPTION messages are already clear, safe, user-facing text -- surface
    // those directly rather than a generic fallback; anything that looks like a raw Postgres/
    // constraint-level message is replaced instead of leaked to the client.
    const looksLikeOurOwnException = !/^(new row|duplicate key|null value|permission denied|relation |column )/i.test(message);
    if (looksLikeOurOwnException && message.length < 300) return message;
  }
  console.error(fallback, err);
  return fallback;
}

export async function registerForExperienceOccurrenceAction(occurrenceId: string): Promise<ExperienceActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to register." };

    const registration = await registerForOccurrence(supabase, occurrenceId);

    revalidatePath("/experiences");
    revalidatePath("/my-experiences");
    return { ok: true, registration };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't register for this occurrence. Please try again.") };
  }
}

export async function cancelMyRegistrationAction(registrationId: string): Promise<ExperienceActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const registration = await cancelRegistration(supabase, registrationId);

    revalidatePath("/experiences");
    revalidatePath("/my-experiences");
    return { ok: true, registration };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't cancel this registration. Please try again.") };
  }
}
