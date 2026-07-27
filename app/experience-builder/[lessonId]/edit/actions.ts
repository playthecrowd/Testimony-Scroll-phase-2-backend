"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { validateRequiredLessonFields, isValidMediaUrl } from "@/lib/lessonForm";
import { computeMediaDiff, EditableMediaItem } from "@/lib/mediaDiff";
import { resolveNextStatus, isValidActionForStatus, LessonEditAction, LessonStatus } from "@/lib/lessonStatus";
import { hasChurchEditAccess } from "@/lib/lessonAuth";

export interface UpdateLessonExperienceInput {
  lessonId: string;
  lessonSlug: string;
  churchId: string;
  churchSlug: string;
  currentStatus: LessonStatus;
  action: LessonEditAction;
  title: string;
  topic: string;
  shortDescription: string;
  aboutText: string;
  subject: string;
  ministryCategory: string;
  speakerName: string;
  date: string;
  durationLabel: string;
  lessonType: string;
  primaryScripture: string;
  supportingScriptures: string[];
  tags: string[];
  questUrl: string;
  questLevel: number | null;
  xpReward: number | null;
  // keepExistingThumbnail=true means "don't touch featured_image_url/alt at all" -- the actual
  // upload (if any) already happened client-side before this action is called; this only ever
  // receives an already-resolved public URL, never a file.
  keepExistingThumbnail: boolean;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  backgroundImageUrl: string | null;
  media: EditableMediaItem[];
  existingMediaIds: string[];
}

export interface UpdateLessonExperienceResult {
  error?: string;
  lesson?: { id: string; slug: string; status: LessonStatus };
}

// Updates the existing lesson row (never inserts a new one -- id is always eq-filtered) plus its
// lesson_media rows. Sequenced per the "no partial destructive updates" requirement: the lessons
// row update is the authorization+validity gate (RLS + required-field checks), and media
// deletions are the very last thing applied, only for ids the Host explicitly removed, only after
// every other write already succeeded.
export async function updateLessonExperience(input: UpdateLessonExperienceInput): Promise<UpdateLessonExperienceResult> {
  const fieldError = validateRequiredLessonFields(input);
  if (fieldError) return { error: fieldError };

  const providedMedia = input.media.filter((m) => (m.url && m.url.trim()) || (m.content && m.content.trim()));
  if (providedMedia.length === 0) {
    return { error: "At least one content source (notes, video, audio, slides, document, or transcript) is required." };
  }
  const invalidMedia = providedMedia.find((m) => m.mediaType !== "transcript" && m.url && !isValidMediaUrl(m.url));
  if (invalidMedia) {
    return { error: "One of your media links doesn't look like a valid web address." };
  }

  if (!isValidActionForStatus(input.currentStatus, input.action)) {
    return { error: "That action isn't available for this lesson's current status." };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to edit a lesson." };

    // Defense-in-depth: the edit page already checked this, but the RLS/trigger layer is the real
    // gate -- this just fails fast with a clear message instead of a raw Postgres error.
    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", input.churchId)
      .maybeSingle();
    if (!hasChurchEditAccess(membership?.role)) {
      return { error: "You are not authorized to edit this lesson." };
    }

    // Race-safe find-or-create, same shape submit_lesson_draft already uses for creation.
    let speakerId: string | null = null;
    if (input.speakerName.trim()) {
      const { data: resolvedSpeakerId, error: speakerError } = await supabase.rpc("find_or_create_speaker", {
        p_church_id: input.churchId,
        p_speaker_name: input.speakerName,
      });
      if (speakerError) return { error: speakerError.message };
      speakerId = resolvedSpeakerId;
    }

    let nextStatus: LessonStatus;
    try {
      nextStatus = resolveNextStatus(input.currentStatus, input.action);
    } catch {
      return { error: "That action isn't available for this lesson's current status." };
    }

    const updatePayload: Record<string, unknown> = {
      title: input.title.trim(),
      short_description: input.shortDescription,
      about_text: input.aboutText || null,
      topic: input.topic,
      subject: input.subject || null,
      ministry_category: input.ministryCategory,
      speaker_id: speakerId,
      date: input.date,
      duration_label: input.durationLabel || null,
      lesson_type: input.lessonType,
      primary_scripture: input.primaryScripture,
      supporting_scriptures: input.supportingScriptures,
      tags: input.tags,
      quest_url: input.questUrl || null,
      quest_level: input.questLevel,
      xp_reward: input.xpReward,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    // Slug is deliberately never touched here -- it stays stable across edits so existing
    // /lessons/[slug] links and bookmarks never break, even if the title changes.
    if (!input.keepExistingThumbnail) {
      updatePayload.featured_image_url = input.featuredImageUrl;
      updatePayload.featured_image_alt = input.featuredImageAlt;
    }
    updatePayload.background_image_url = input.backgroundImageUrl || null;

    // .select().maybeSingle() after the update matters here exactly like publishLesson: if RLS
    // silently blocks an unauthorized update, Postgres reports 0 rows affected rather than an
    // error -- without checking for a returned row this would otherwise report a false success.
    const { data: updatedLesson, error: updateError } = await supabase
      .from("lessons")
      .update(updatePayload)
      .eq("id", input.lessonId)
      .select("id, slug, status")
      .maybeSingle();
    if (updateError) return { error: updateError.message };
    if (!updatedLesson) return { error: "You are not authorized to update this lesson." };

    // Media changes only happen now that the lessons row update above is confirmed authorized
    // and valid. Update existing rows and insert new ones first; deletions (scoped to exactly the
    // ids the Host removed, for this lesson only) are applied last.
    const diff = computeMediaDiff(
      input.existingMediaIds.map((id) => ({ id })),
      providedMedia
    );

    for (const item of diff.toUpdate) {
      const { error: mediaUpdateError } = await supabase
        .from("lesson_media")
        .update({
          media_type: item.mediaType,
          url: item.url || null,
          content: item.content || null,
          title: item.title || null,
          sort_order: item.sortOrder,
        })
        .eq("id", item.id)
        .eq("lesson_id", input.lessonId);
      if (mediaUpdateError) {
        return { error: `Lesson details were saved, but a media item couldn't be updated: ${mediaUpdateError.message}` };
      }
    }

    if (diff.toInsert.length > 0) {
      const { error: mediaInsertError } = await supabase.from("lesson_media").insert(
        diff.toInsert.map((item) => ({
          lesson_id: input.lessonId,
          media_type: item.mediaType,
          url: item.url || null,
          content: item.content || null,
          title: item.title || null,
          sort_order: item.sortOrder,
        }))
      );
      if (mediaInsertError) {
        return { error: `Lesson details were saved, but a new media item couldn't be added: ${mediaInsertError.message}` };
      }
    }

    if (diff.toDeleteIds.length > 0) {
      const { error: mediaDeleteError } = await supabase
        .from("lesson_media")
        .delete()
        .eq("lesson_id", input.lessonId)
        .in("id", diff.toDeleteIds);
      if (mediaDeleteError) {
        return { error: `Lesson details were saved, but a removed media item couldn't be deleted: ${mediaDeleteError.message}` };
      }
    }

    revalidatePath(`/lessons/${updatedLesson.slug}`);
    revalidatePath("/lessons");
    revalidatePath("/churches");
    revalidatePath(`/churches/${input.churchSlug}`);
    revalidatePath("/host-dashboard");
    revalidatePath("/experience-builder");
    revalidatePath(`/experience-builder/${updatedLesson.slug}/edit`);

    return { lesson: { id: updatedLesson.id, slug: updatedLesson.slug, status: updatedLesson.status as LessonStatus } };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateLessonExperience] Unexpected error:", err);
    return { error: "Something went wrong saving your changes. Please try again." };
  }
}
