"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  createCampaignLesson,
  updateCampaignLesson,
  CampaignLessonInput,
  CampaignLessonUpdateInput,
} from "@/services/supabase/lessons";

export interface CampaignLessonActionResult {
  error?: string;
  id?: string;
}

function revalidateCampaignLessonPaths(id?: string) {
  revalidatePath("/admin/campaign-lessons");
  revalidatePath("/");
  revalidatePath("/lessons");
  if (id) revalidatePath(`/admin/campaign-lessons/${id}/edit`);
}

export async function createCampaignLessonAction(input: CampaignLessonInput): Promise<CampaignLessonActionResult> {
  if (!input.title.trim()) return { error: "Lesson title is required." };
  if (!input.campaignName.trim()) return { error: "Campaign name is required." };

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    const lesson = await createCampaignLesson(supabase, input);
    await logAdminAction(supabase, { action: "create", entityType: "campaign_lesson", entityId: lesson.id, detail: lesson.title });
    revalidateCampaignLessonPaths(lesson.id);
    return { id: lesson.id };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[createCampaignLessonAction] Unexpected error:", err);
    return { error: "Something went wrong creating this campaign lesson. Please try again." };
  }
}

export async function updateCampaignLessonAction(
  id: string,
  input: CampaignLessonUpdateInput
): Promise<CampaignLessonActionResult> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    const lesson = await updateCampaignLesson(supabase, id, input);
    await logAdminAction(supabase, { action: "update", entityType: "campaign_lesson", entityId: id, detail: lesson.title });
    revalidateCampaignLessonPaths(id);
    revalidatePath(`/lessons/${lesson.slug}`);
    return { id };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateCampaignLessonAction] Unexpected error:", err);
    return { error: "Something went wrong saving this campaign lesson. Please try again." };
  }
}

// Quick list-view toggles (publish/unpublish, feature, highlight) -- same shape as the update
// action, just a narrower input, matching updateLessonFeatured's role for church-authored lessons.
export async function setCampaignLessonStatusAction(id: string, status: "draft" | "published"): Promise<CampaignLessonActionResult> {
  return updateCampaignLessonAction(id, { status });
}

export async function setCampaignLessonFeaturedAction(id: string, isFeatured: boolean): Promise<CampaignLessonActionResult> {
  return updateCampaignLessonAction(id, { isFeatured });
}

export async function setCampaignLessonHighlightedAction(id: string, isHighlighted: boolean): Promise<CampaignLessonActionResult> {
  return updateCampaignLessonAction(id, { isHighlighted });
}

export async function setCampaignLessonSortOrderAction(id: string, sortOrder: number): Promise<CampaignLessonActionResult> {
  return updateCampaignLessonAction(id, { sortOrder });
}
