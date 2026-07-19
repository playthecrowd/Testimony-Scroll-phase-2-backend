"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import { updateTestimonyPlatformStatus, updateTestimonyFeatured } from "@/services/supabase/testimonies";
import { TestimonyPlatformStatus } from "@/types";

export async function updatePlatformTestimonyStatusAction(
  testimonyId: string,
  status: TestimonyPlatformStatus
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateTestimonyPlatformStatus(supabase, testimonyId, status);
    await logAdminAction(supabase, { action: `testimony_platform_${status}`, entityType: "testimony", entityId: testimonyId });
    revalidatePath("/admin/testimonies");
    revalidatePath("/kingdom-scroll");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updatePlatformTestimonyStatusAction] Unexpected error:", err);
    return { error: "Couldn't update that testimony. Please try again." };
  }
}

export async function updateTestimonyFeaturedAction(testimonyId: string, featured: boolean): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateTestimonyFeatured(supabase, testimonyId, featured);
    await logAdminAction(supabase, {
      action: featured ? "testimony_featured" : "testimony_unfeatured",
      entityType: "testimony",
      entityId: testimonyId,
    });
    revalidatePath("/admin/testimonies");
    revalidatePath("/kingdom-scroll");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateTestimonyFeaturedAction] Unexpected error:", err);
    return { error: "Couldn't update this testimony's featured status. Please try again." };
  }
}
