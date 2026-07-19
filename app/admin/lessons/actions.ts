"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import { updateLessonFeatured } from "@/services/supabase/lessons";

export async function updateLessonFeaturedAction(lessonId: string, featured: boolean): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateLessonFeatured(supabase, lessonId, featured);
    await logAdminAction(supabase, {
      action: featured ? "lesson_featured" : "lesson_unfeatured",
      entityType: "lesson",
      entityId: lessonId,
    });
    revalidatePath("/admin/lessons");
    revalidatePath("/lessons");
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateLessonFeaturedAction] Unexpected error:", err);
    return { error: "Couldn't update this lesson's featured status. Please try again." };
  }
}
