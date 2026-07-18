import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PublishedTestimony,
  PublishedTestimonyVisibility,
  TestimonyIdentityDisplay,
  TestimonyChurchStatus,
  TestimonyPlatformStatus,
} from "@/types";

const TESTIMONY_SELECT = `
  id, church_id, primary_lesson_id, supporting_lesson_ids, title, topic, scripture, written_testimony,
  video_url, audio_url, visibility, identity_display, display_name, suggested_character,
  story_generation_permission, future_episode_permission, voice_likeness_permission,
  church_status, platform_status, featured, created_at, updated_at,
  church:churches(name),
  primary_lesson:lessons(title, slug)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTestimony(row: any): PublishedTestimony {
  return {
    id: row.id,
    churchId: row.church_id,
    churchName: row.church?.name ?? null,
    primaryLessonId: row.primary_lesson_id,
    primaryLessonTitle: row.primary_lesson?.title ?? null,
    primaryLessonSlug: row.primary_lesson?.slug ?? null,
    supportingLessonIds: row.supporting_lesson_ids ?? [],
    title: row.title,
    topic: row.topic,
    scripture: row.scripture,
    writtenTestimony: row.written_testimony,
    videoUrl: row.video_url,
    audioUrl: row.audio_url,
    visibility: row.visibility,
    identityDisplay: row.identity_display,
    displayName: row.display_name,
    suggestedCharacter: row.suggested_character,
    storyGenerationPermission: row.story_generation_permission,
    futureEpisodePermission: row.future_episode_permission,
    voiceLikenessPermission: row.voice_likeness_permission,
    churchStatus: row.church_status,
    platformStatus: row.platform_status,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTestimonyInput {
  primaryLessonId: string;
  supportingLessonIds: string[];
  title: string;
  topic: string;
  scripture: string;
  writtenTestimony: string;
  videoUrl: string;
  audioUrl: string;
  visibility: PublishedTestimonyVisibility;
  identityDisplay: TestimonyIdentityDisplay;
  suggestedCharacter: string;
  storyGenerationPermission: boolean;
  futureEpisodePermission: boolean;
  voiceLikenessPermission: boolean;
}

// church_id is deliberately never sent here -- the testimonies_before_insert trigger
// (0018_testimonies.sql) derives it from primary_lesson_id and also enforces that every attached
// lesson (primary + supporting) is one the caller has actually completed.
export async function createTestimony(supabase: SupabaseClient, input: CreateTestimonyInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to submit a testimony.");

  const { error } = await supabase.from("testimonies").insert({
    submitted_by: user.id,
    primary_lesson_id: input.primaryLessonId,
    supporting_lesson_ids: input.supportingLessonIds,
    title: input.title,
    topic: input.topic || null,
    scripture: input.scripture || null,
    written_testimony: input.writtenTestimony,
    video_url: input.videoUrl || null,
    audio_url: input.audioUrl || null,
    visibility: input.visibility,
    identity_display: input.identityDisplay,
    suggested_character: input.suggestedCharacter || null,
    story_generation_permission: input.storyGenerationPermission,
    future_episode_permission: input.futureEpisodePermission,
    voice_likeness_permission: input.voiceLikenessPermission,
    church_status: "pending",
    platform_status: input.visibility === "public" ? "pending" : "not_submitted",
  });
  if (error) throw error;
}

export async function getMyTestimonies(supabase: SupabaseClient): Promise<PublishedTestimony[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_SELECT)
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTestimony);
}

// Host-facing: every testimony submitted to a church the caller manages (RLS: testimonies_select_managed).
export async function getChurchTestimonies(supabase: SupabaseClient, churchId: string): Promise<PublishedTestimony[]> {
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_SELECT)
    .eq("church_id", churchId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTestimony);
}

// Admin-facing: public testimonies already approved at the church level, awaiting platform
// moderation (RLS: only a platform admin can see these before platform approval).
export async function getPendingPublicTestimonies(supabase: SupabaseClient): Promise<PublishedTestimony[]> {
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_SELECT)
    .eq("visibility", "public")
    .eq("church_status", "approved")
    .in("platform_status", ["pending"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapTestimony);
}

// Public-facing Kingdom Scroll (RLS: testimonies_select_public_approved).
export async function getApprovedPublicTestimonies(supabase: SupabaseClient): Promise<PublishedTestimony[]> {
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_SELECT)
    .eq("visibility", "public")
    .eq("church_status", "approved")
    .eq("platform_status", "approved")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTestimony);
}

export async function getTestimonyById(supabase: SupabaseClient, id: string): Promise<PublishedTestimony | null> {
  const { data, error } = await supabase.from("testimonies").select(TESTIMONY_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapTestimony(data) : null;
}

export async function updateTestimonyChurchStatus(
  supabase: SupabaseClient,
  testimonyId: string,
  status: TestimonyChurchStatus
): Promise<void> {
  const { error } = await supabase.from("testimonies").update({ church_status: status }).eq("id", testimonyId);
  if (error) throw error;
}

export async function updateTestimonyPlatformStatus(
  supabase: SupabaseClient,
  testimonyId: string,
  status: TestimonyPlatformStatus
): Promise<void> {
  const { error } = await supabase.from("testimonies").update({ platform_status: status }).eq("id", testimonyId);
  if (error) throw error;
}

export async function updateTestimonyFeatured(supabase: SupabaseClient, testimonyId: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from("testimonies").update({ featured }).eq("id", testimonyId);
  if (error) throw error;
}

export async function getTestimonyLikeInfo(supabase: SupabaseClient, testimonyId: string): Promise<{ count: number; likedByMe: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count, error } = await supabase
    .from("testimony_likes")
    .select("id", { count: "exact", head: true })
    .eq("testimony_id", testimonyId);
  if (error) throw error;

  let likedByMe = false;
  if (user) {
    const { data } = await supabase
      .from("testimony_likes")
      .select("id")
      .eq("testimony_id", testimonyId)
      .eq("profile_id", user.id)
      .maybeSingle();
    likedByMe = !!data;
  }

  return { count: count ?? 0, likedByMe };
}

export async function toggleTestimonyLike(supabase: SupabaseClient, testimonyId: string, like: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to like a testimony.");

  if (like) {
    const { error } = await supabase.from("testimony_likes").insert({ testimony_id: testimonyId, profile_id: user.id });
    // Already liked -- the (testimony_id, profile_id) unique constraint makes this a harmless no-op.
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("testimony_likes")
      .delete()
      .eq("testimony_id", testimonyId)
      .eq("profile_id", user.id);
    if (error) throw error;
  }
}
