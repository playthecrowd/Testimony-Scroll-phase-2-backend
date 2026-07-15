import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishedLesson } from "@/types";
import { mapChurch } from "./churches";

const CHURCH_FIELDS = "id, name, slug, logo_url, city, region, country, member_count, description, verified";

const LESSON_SELECT = `
  id, slug, title, short_description, about_text, topic, subject, ministry_category,
  date, duration_label, lesson_type, primary_scripture, supporting_scriptures, tags,
  featured_image_url, featured_image_alt, quest_url, quest_level, xp_reward, status, contributors_count, created_at, updated_at,
  church:churches(${CHURCH_FIELDS}),
  speaker:speakers(id, name, avatar_url, bio),
  media:lesson_media(id, media_type, url, content, title, sort_order),
  hosts:lesson_hosts(id, status, participant_count, schedule_label, quest_url, church:churches(${CHURCH_FIELDS})),
  lesson_ministries(ministry:ministries(id, name))
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLesson(row: any): PublishedLesson {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    aboutText: row.about_text,
    topic: row.topic,
    subject: row.subject,
    ministryCategory: row.ministry_category,
    date: row.date,
    durationLabel: row.duration_label,
    lessonType: row.lesson_type,
    primaryScripture: row.primary_scripture,
    supportingScriptures: row.supporting_scriptures ?? [],
    tags: row.tags ?? [],
    featuredImageUrl: row.featured_image_url,
    featuredImageAlt: row.featured_image_alt,
    questUrl: row.quest_url,
    questLevel: row.quest_level,
    xpReward: row.xp_reward,
    status: row.status,
    contributorsCount: row.contributors_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    church: mapChurch(row.church),
    speaker: row.speaker
      ? { id: row.speaker.id, name: row.speaker.name, avatarUrl: row.speaker.avatar_url, bio: row.speaker.bio }
      : null,
    media: (row.media ?? [])
      .slice()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({ id: m.id, mediaType: m.media_type, url: m.url, content: m.content, title: m.title })),
    hosts: (row.hosts ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (h: any) => ({
        id: h.id,
        status: h.status,
        participantCount: h.participant_count ?? 0,
        scheduleLabel: h.schedule_label,
        questUrl: h.quest_url,
        church: h.church ? mapChurch(h.church) : null,
      })
    ),
    ministries: (row.lesson_ministries ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((lm: any) => lm.ministry)
      .filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({ id: m.id, name: m.name })),
  };
}

export async function getPublishedLessons(supabase: SupabaseClient): Promise<PublishedLesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("status", "published")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}

export async function getPublishedLessonsByChurch(
  supabase: SupabaseClient,
  churchId: string
): Promise<PublishedLesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("status", "published")
    .eq("church_id", churchId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}

// RLS makes this viewer-aware: a public visitor only ever gets a published row back; the
// host/admin who manages that lesson's church also gets their own draft. No separate
// "preview" route or query needed -- see docs/SUPABASE_SETUP.md / the plan for details.
export async function getLessonBySlug(supabase: SupabaseClient, slug: string): Promise<PublishedLesson | null> {
  const { data, error } = await supabase.from("lessons").select(LESSON_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? mapLesson(data) : null;
}

// Deliberately no .eq("status", ...) filter -- this is for the Host lesson-management view, so
// RLS is what should decide visibility: published rows are visible to everyone, and draft rows
// only come back at all because the caller manages this church (lessons_select_published_or_managed).
export async function getManagedLessonsByChurch(supabase: SupabaseClient, churchId: string): Promise<PublishedLesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("church_id", churchId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}
