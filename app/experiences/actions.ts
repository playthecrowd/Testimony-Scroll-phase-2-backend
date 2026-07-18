"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { registerForOccurrence, cancelRegistration, getOccurrenceById, getExperienceById } from "@/services/supabase/churchExperiences";
import { getMyMemberWallet } from "@/services/supabase/wallets";
import { calculateExperienceCreditCost, hasSufficientBalanceForCost } from "@/lib/experienceCredits";
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

// Phase 11.2: read-only preview of what registering for this occurrence would cost and whether
// the signed-in member can currently afford it -- a UX convenience only. The database's own
// charge_credits_on_registration_confirmation trigger (0031) remains the sole authority on the
// actual charge; this never decides whether a registration is allowed, it only lets a future UI
// show "this costs N credits" (and, once /credit-requests exists, offer that path) before the
// member commits.
export interface ExperienceCreditPreview {
  cost: number | null;
  balance: number;
  sufficient: boolean;
}

export interface ExperienceCreditPreviewResult {
  error?: string;
  ok?: boolean;
  preview?: ExperienceCreditPreview;
}

export async function getExperienceCreditPreviewAction(occurrenceId: string): Promise<ExperienceCreditPreviewResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in." };

    const occurrence = await getOccurrenceById(supabase, occurrenceId);
    if (!occurrence) return { error: "That occurrence could not be found." };
    const experience = await getExperienceById(supabase, occurrence.experienceId);
    if (!experience) return { error: "The parent Experience could not be found." };

    const cost = calculateExperienceCreditCost(experience, occurrence);
    const wallet = await getMyMemberWallet(supabase);
    const balance = wallet?.currentBalance ?? 0;

    return { ok: true, preview: { cost, balance, sufficient: hasSufficientBalanceForCost(balance, cost) } };
  } catch (err) {
    return { error: safeErrorMessage(err, "Couldn't check the credit cost for this occurrence. Please try again.") };
  }
}
