"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import { updateSpeakerRequestStatus } from "@/services/supabase/speakerRequests";
import { SpeakerRequestStatus } from "@/types";

export interface SpeakerRequestActionResult {
  error?: string;
}

export async function updateSpeakerRequestStatusAction(id: string, status: SpeakerRequestStatus): Promise<SpeakerRequestActionResult> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateSpeakerRequestStatus(supabase, id, status);
    await logAdminAction(supabase, { action: "update_status", entityType: "speaker_request", entityId: id, detail: status });
    revalidatePath("/admin/speaker-requests");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateSpeakerRequestStatusAction] Unexpected error:", err);
    return { error: "Something went wrong updating this request. Please try again." };
  }
}
