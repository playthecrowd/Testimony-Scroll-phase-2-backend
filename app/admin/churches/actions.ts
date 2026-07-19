"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import { updateChurchVerified } from "@/services/supabase/churches";

export async function updateChurchVerifiedAction(churchId: string, verified: boolean): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateChurchVerified(supabase, churchId, verified);
    await logAdminAction(supabase, {
      action: verified ? "church_verified" : "church_unverified",
      entityType: "church",
      entityId: churchId,
    });
    revalidatePath("/admin/churches");
    revalidatePath("/churches");
    revalidatePath(`/churches/${churchId}`);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateChurchVerifiedAction] Unexpected error:", err);
    return { error: "Couldn't update this church's verification status. Please try again." };
  }
}
