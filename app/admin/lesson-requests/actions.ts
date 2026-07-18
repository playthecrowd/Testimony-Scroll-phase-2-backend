"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { updateLessonRequestStatus } from "@/services/supabase/lessonRequests";
import { LessonRequestStatus } from "@/types";

// Public requests only move through these transitions here -- fulfilling/declining a
// church-directed request is the Host action (app/host-dashboard/lesson-requests/actions.ts).
const ADMIN_ALLOWED_STATUSES: LessonRequestStatus[] = ["under_review", "approved", "declined"];

export async function updatePublicLessonRequestStatusAction(
  requestId: string,
  status: LessonRequestStatus
): Promise<{ error?: string }> {
  if (!ADMIN_ALLOWED_STATUSES.includes(status)) {
    return { error: "That status isn't available for a public request." };
  }

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateLessonRequestStatus(supabase, requestId, status);
    revalidatePath("/admin/lesson-requests");
    revalidatePath("/lesson-requests");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updatePublicLessonRequestStatusAction] Unexpected error:", err);
    return { error: "Couldn't update that request. Please try again." };
  }
}
