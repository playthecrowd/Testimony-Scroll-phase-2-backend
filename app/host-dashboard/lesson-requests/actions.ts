"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { updateLessonRequestStatus } from "@/services/supabase/lessonRequests";
import { LessonRequestStatus } from "@/types";

// A church-directed request's own manager may only move it through these transitions -- approving
// public requests is the admin action (app/admin/lesson-requests/actions.ts), not this one.
const HOST_ALLOWED_STATUSES: LessonRequestStatus[] = ["under_review", "fulfilled", "declined"];

export async function updateChurchLessonRequestStatusAction(
  requestId: string,
  churchId: string,
  status: LessonRequestStatus
): Promise<{ error?: string }> {
  if (!HOST_ALLOWED_STATUSES.includes(status)) {
    return { error: "That status isn't available for a church-directed request." };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to manage lesson requests." };

    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", churchId)
      .maybeSingle();
    if (!hasChurchEditAccess(membership?.role)) {
      return { error: "You are not authorized to manage this church's lesson requests." };
    }

    await updateLessonRequestStatus(supabase, requestId, status);
    revalidatePath("/host-dashboard/lesson-requests");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateChurchLessonRequestStatusAction] Unexpected error:", err);
    return { error: "Couldn't update that request. Please try again." };
  }
}
