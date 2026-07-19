"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { LessonMediaType } from "@/types";

export interface SubmitLessonDraftInput {
  churchId: string;
  title: string;
  topic: string;
  shortDescription: string;
  ministryCategory: string;
  speakerName: string;
  date: string;
  lessonType: string;
  primaryScripture: string;
  supportingScriptures: string[];
  tags: string[];
  questUrl?: string;
  media: { mediaType: LessonMediaType; url?: string; content?: string; title?: string }[];
}

export interface SubmitLessonDraftResult {
  error?: string;
  lesson?: { id: string; slug: string; title: string; churchSlug: string };
}

export async function submitLessonDraft(input: SubmitLessonDraftInput): Promise<SubmitLessonDraftResult> {
  // Defense-in-depth: the RPC/RLS enforce this server-side too, but fail fast with a clear message.
  if (!input.title?.trim()) return { error: "Lesson title is required." };
  if (!input.topic?.trim()) return { error: "Main topic is required." };
  if (!input.shortDescription?.trim()) return { error: "Short description is required." };
  if (!input.speakerName?.trim()) return { error: "Speaker/teacher is required." };
  if (!input.date?.trim()) return { error: "Lesson date is required." };
  if (!input.ministryCategory?.trim()) return { error: "Ministry category is required." };
  if (!input.primaryScripture?.trim()) return { error: "Primary scripture is required." };
  if (!input.churchId) return { error: "A church is required." };

  const providedMedia = input.media.filter((m) => (m.url && m.url.trim()) || (m.content && m.content.trim()));
  if (providedMedia.length === 0) {
    return { error: "At least one content source (notes, video, audio, slides, document, or transcript) is required." };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to submit a lesson." };

    // Defense-in-depth, with a friendly message: the RPC/RLS would reject an unauthorized
    // church_id too, but as a raw Postgres error rather than something a Host should have to read.
    const { data: membership } = await supabase
      .from("church_memberships")
      .select("role")
      .eq("profile_id", user.id)
      .eq("church_id", input.churchId)
      .in("role", ["host", "admin"])
      .maybeSingle();
    if (!membership) {
      return { error: "You are not authorized to submit lessons for that church." };
    }

    const { data, error } = await supabase.rpc("submit_lesson_draft", {
      p_church_id: input.churchId,
      p_title: input.title,
      p_short_description: input.shortDescription,
      p_about_text: input.shortDescription,
      p_topic: input.topic,
      p_subject: input.topic,
      p_ministry_name: input.ministryCategory,
      p_speaker_name: input.speakerName,
      p_date: input.date,
      p_lesson_type: input.lessonType,
      p_primary_scripture: input.primaryScripture,
      p_supporting_scriptures: input.supportingScriptures,
      p_tags: input.tags,
      p_quest_url: input.questUrl || null,
      p_media: providedMedia.map((m) => ({
        media_type: m.mediaType,
        url: m.url || null,
        content: m.content || null,
        title: m.title || null,
      })),
    });

    if (error) return { error: error.message };

    const { data: church } = await supabase.from("churches").select("slug").eq("id", input.churchId).maybeSingle();
    const churchSlug = church?.slug ?? input.churchId;

    // The draft itself is only visible to its own host (RLS), but keep the host-facing
    // surfaces that reference it fresh rather than serving a cached miss.
    revalidatePath(`/lessons/${data.slug}`);
    revalidatePath(`/churches/${churchSlug}`);
    revalidatePath("/host-dashboard");

    return { lesson: { id: data.id, slug: data.slug, title: data.title, churchSlug } };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    return { error: "Something went wrong submitting your lesson. Please try again." };
  }
}
