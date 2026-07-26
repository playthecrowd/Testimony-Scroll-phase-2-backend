import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishedLesson } from "@/types";
import { mapChurch } from "./churches";
import { mapExperience } from "./experiences";
import { mapQuestion } from "./questions";

const CHURCH_FIELDS = "id, name, slug, logo_url, city, region, country, member_count, description, verified";
const EXPERIENCE_FIELDS = "id, name, description, preview_image_url";

const LESSON_SELECT = `
  id, slug, title, short_description, about_text, topic, subject, ministry_category,
  date, duration_label, lesson_type, primary_scripture, supporting_scriptures, tags,
  featured_image_url, featured_image_alt, quest_url, quest_level, xp_reward, status, contributors_count, featured, created_at, updated_at,
  is_campaign_lesson, campaign_name, campaign_sprint_season, campaign_month, campaign_month_number,
  campaign_week_number, campaign_monthly_theme, campaign_monthly_verse, campaign_weekly_verse,
  campaign_speaker_name, campaign_speaker_bio, campaign_speaker_image_url, is_highlighted,
  sort_order, display_start_date, linked_experience_id,
  church:churches(${CHURCH_FIELDS}),
  speaker:speakers(id, name, avatar_url, bio),
  media:lesson_media(id, media_type, url, content, title, sort_order),
  hosts:lesson_hosts(id, status, participant_count, schedule_label, quest_url, church:churches(${CHURCH_FIELDS})),
  lesson_ministries(ministry:ministries(id, name)),
  questions:lesson_questions(id, question, sort_order, choices:lesson_question_choices(id, answer_text, sort_order, is_correct)),
  lesson_experiences(id, relationship_note, experience:experiences(${EXPERIENCE_FIELDS}))
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
    featured: row.featured ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Campaign lessons have no owning church -- row.church is null for those (the churches join
    // simply returns nothing for a null church_id). Every non-campaign lesson still has one.
    church: row.church ? mapChurch(row.church) : null,
    isCampaignLesson: row.is_campaign_lesson ?? false,
    campaignName: row.campaign_name ?? null,
    campaignSprintSeason: row.campaign_sprint_season ?? null,
    campaignMonth: row.campaign_month ?? null,
    campaignMonthNumber: row.campaign_month_number ?? null,
    campaignWeekNumber: row.campaign_week_number ?? null,
    campaignMonthlyTheme: row.campaign_monthly_theme ?? null,
    campaignMonthlyVerse: row.campaign_monthly_verse ?? null,
    campaignWeeklyVerse: row.campaign_weekly_verse ?? null,
    campaignSpeakerName: row.campaign_speaker_name ?? null,
    campaignSpeakerBio: row.campaign_speaker_bio ?? null,
    campaignSpeakerImageUrl: row.campaign_speaker_image_url ?? null,
    isHighlighted: row.is_highlighted ?? false,
    sortOrder: row.sort_order ?? 0,
    displayStartDate: row.display_start_date ?? null,
    linkedExperienceId: row.linked_experience_id ?? null,
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
    questions: (row.questions ?? [])
      .slice()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(mapQuestion),
    experiences: (row.lesson_experiences ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((le: any) => le.experience)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((le: any) => ({ id: le.id, relationshipNote: le.relationship_note, experience: mapExperience(le.experience) })),
  };
}

// Adds one lesson_media row to an already-created lesson -- used for the create wizard's deferred
// document upload (the file can only be uploaded to Storage once the lesson has a real id, same
// reason the thumbnail upload is a second phase after creation; see ExperienceBuilderForm).
export async function addLessonMediaItem(
  supabase: SupabaseClient,
  lessonId: string,
  mediaType: string,
  url: string
): Promise<void> {
  const { error } = await supabase.from("lesson_media").insert({ lesson_id: lessonId, media_type: mediaType, url });
  if (error) throw error;
}

export async function updateLessonFeatured(supabase: SupabaseClient, lessonId: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from("lessons").update({ featured }).eq("id", lessonId);
  if (error) throw error;
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

// RLS-gated exactly like getLessonBySlug -- a published lesson is visible to anyone, a draft only
// to its own church's host/admin. Used by the journey routes, which link by lessons.id (UUID),
// never by slug.
export async function getLessonById(supabase: SupabaseClient, id: string): Promise<PublishedLesson | null> {
  const { data, error } = await supabase.from("lessons").select(LESSON_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapLesson(data) : null;
}

export async function getLessonsByIds(supabase: SupabaseClient, ids: string[]): Promise<PublishedLesson[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("lessons").select(LESSON_SELECT).in("id", ids);
  if (error) throw error;
  return (data ?? []).map(mapLesson);
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

// ---------------------------------------------------------------------------
// Year-Round Campaign Lessons (Phase Two) -- an admin-managed extension of this same lessons
// table (is_campaign_lesson = true, church_id null), not a parallel content system. See
// supabase/migrations/0038_campaign_lessons.sql.
// ---------------------------------------------------------------------------

export async function getCampaignLessons(supabase: SupabaseClient): Promise<PublishedLesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("status", "published")
    .eq("is_campaign_lesson", true)
    .order("campaign_month_number", { ascending: true, nullsFirst: false })
    .order("campaign_week_number", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}

// The homepage's "Start This Week's Lesson" CTA and the featured weekly row both need "what's
// current right now" -- the most recently started campaign lesson whose display_start_date has
// already arrived. Falls back to the most recently published campaign lesson if none has a
// display_start_date in the past yet (e.g. early in setup, before any date is reached).
export async function getCurrentWeekCampaignLesson(supabase: SupabaseClient): Promise<PublishedLesson | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("status", "published")
    .eq("is_campaign_lesson", true)
    .lte("display_start_date", today)
    .order("display_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return mapLesson(data);

  const { data: fallback, error: fallbackError } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("status", "published")
    .eq("is_campaign_lesson", true)
    .order("campaign_month_number", { ascending: true, nullsFirst: false })
    .order("campaign_week_number", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (fallbackError) throw fallbackError;
  return fallback ? mapLesson(fallback) : null;
}

// Admin list view -- deliberately no .eq("status", ...) filter, same reasoning as
// getManagedLessonsByChurch: RLS decides visibility (an admin sees every campaign lesson,
// published or draft, via private.is_church_manager's platform-admin bypass; see the migration).
export async function getAllCampaignLessonsForAdmin(supabase: SupabaseClient): Promise<PublishedLesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("is_campaign_lesson", true)
    .order("campaign_month_number", { ascending: true, nullsFirst: false })
    .order("campaign_week_number", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}

export interface CampaignLessonInput {
  campaignName: string;
  campaignSprintSeason: string;
  campaignMonth: string;
  campaignMonthNumber: number | null;
  campaignWeekNumber: number | null;
  campaignMonthlyTheme: string;
  campaignMonthlyVerse: string;
  title: string;
  shortDescription: string;
  aboutText: string;
  campaignWeeklyVerse: string;
  campaignSpeakerName: string;
  campaignSpeakerBio: string;
  campaignSpeakerImageUrl: string;
  featuredImageUrl: string;
  isFeatured: boolean;
  isHighlighted: boolean;
  sortOrder: number;
  displayStartDate: string;
  linkedExperienceId: string | null;
}

// Same slugification algorithm as submit_lesson_draft's RPC (supabase/migrations/0003_functions.sql)
// so campaign-lesson slugs look and behave identically to church-authored ones -- lowercase,
// non-alphanumeric runs collapsed to a single hyphen, trimmed, falls back to a fixed base if the
// title has no alphanumeric characters at all.
function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "campaign-lesson";
}

async function generateUniqueCampaignSlug(supabase: SupabaseClient, title: string, taken: Set<string>): Promise<string> {
  const base = slugifyTitle(title);
  let slug = base;
  let suffix = 1;
  // Mirrors the RPC's own while-loop uniqueness check; campaign-lesson creation is an
  // infrequent, admin-only action, so a client-side check-then-insert race is an acceptable,
  // low-risk tradeoff against adding a second SECURITY DEFINER RPC purely for this. `taken` also
  // guards against two rows in the same batch (e.g. a CSV import) colliding with each other,
  // which a DB-only uniqueness check can't catch before either has been inserted yet.
  while (true) {
    if (!taken.has(slug)) {
      const { data } = await supabase.from("lessons").select("id").eq("slug", slug).maybeSingle();
      if (!data) return slug;
    }
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCampaignLessonInsertRow(input: CampaignLessonInput, slug: string): Record<string, any> {
  return {
    slug,
    title: input.title.trim(),
    short_description: input.shortDescription.trim() || null,
    about_text: input.aboutText.trim() || null,
    status: "draft",
    church_id: null,
    speaker_id: null,
    is_campaign_lesson: true,
    campaign_name: input.campaignName.trim() || null,
    campaign_sprint_season: input.campaignSprintSeason.trim() || null,
    campaign_month: input.campaignMonth.trim() || null,
    campaign_month_number: input.campaignMonthNumber,
    campaign_week_number: input.campaignWeekNumber,
    campaign_monthly_theme: input.campaignMonthlyTheme.trim() || null,
    campaign_monthly_verse: input.campaignMonthlyVerse.trim() || null,
    campaign_weekly_verse: input.campaignWeeklyVerse.trim() || null,
    campaign_speaker_name: input.campaignSpeakerName.trim() || null,
    campaign_speaker_bio: input.campaignSpeakerBio.trim() || null,
    campaign_speaker_image_url: input.campaignSpeakerImageUrl.trim() || null,
    featured_image_url: input.featuredImageUrl.trim() || null,
    featured: input.isFeatured,
    is_highlighted: input.isHighlighted,
    sort_order: input.sortOrder,
    display_start_date: input.displayStartDate || null,
    linked_experience_id: input.linkedExperienceId,
  };
}

export async function createCampaignLesson(supabase: SupabaseClient, input: CampaignLessonInput): Promise<PublishedLesson> {
  const slug = await generateUniqueCampaignSlug(supabase, input.title, new Set());
  const { data, error } = await supabase
    .from("lessons")
    .insert(buildCampaignLessonInsertRow(input, slug))
    .select(LESSON_SELECT)
    .single();
  if (error) throw error;
  return mapLesson(data);
}

// Bulk CSV import path -- a single multi-row insert, so it succeeds or fails atomically as one
// SQL statement (unlike a loop of individual creates, where a failure partway through would leave
// some rows imported and others not). Every input is expected to already be validated by the
// caller (see lib/campaignLessonCsv.ts) -- this function's job is slugging + the atomic write.
export async function createCampaignLessonsBatch(supabase: SupabaseClient, inputs: CampaignLessonInput[]): Promise<PublishedLesson[]> {
  if (inputs.length === 0) return [];
  const taken = new Set<string>();
  const rows = [];
  for (const input of inputs) {
    const slug = await generateUniqueCampaignSlug(supabase, input.title, taken);
    taken.add(slug);
    rows.push(buildCampaignLessonInsertRow(input, slug));
  }
  const { data, error } = await supabase.from("lessons").insert(rows).select(LESSON_SELECT);
  if (error) throw error;
  return (data ?? []).map(mapLesson);
}

export type CampaignLessonUpdateInput = Partial<CampaignLessonInput> & { status?: "draft" | "published" };

export async function updateCampaignLesson(
  supabase: SupabaseClient,
  lessonId: string,
  input: CampaignLessonUpdateInput
): Promise<PublishedLesson> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.campaignName !== undefined) patch.campaign_name = input.campaignName.trim() || null;
  if (input.campaignSprintSeason !== undefined) patch.campaign_sprint_season = input.campaignSprintSeason.trim() || null;
  if (input.campaignMonth !== undefined) patch.campaign_month = input.campaignMonth.trim() || null;
  if (input.campaignMonthNumber !== undefined) patch.campaign_month_number = input.campaignMonthNumber;
  if (input.campaignWeekNumber !== undefined) patch.campaign_week_number = input.campaignWeekNumber;
  if (input.campaignMonthlyTheme !== undefined) patch.campaign_monthly_theme = input.campaignMonthlyTheme.trim() || null;
  if (input.campaignMonthlyVerse !== undefined) patch.campaign_monthly_verse = input.campaignMonthlyVerse.trim() || null;
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription.trim() || null;
  if (input.aboutText !== undefined) patch.about_text = input.aboutText.trim() || null;
  if (input.campaignWeeklyVerse !== undefined) patch.campaign_weekly_verse = input.campaignWeeklyVerse.trim() || null;
  if (input.campaignSpeakerName !== undefined) patch.campaign_speaker_name = input.campaignSpeakerName.trim() || null;
  if (input.campaignSpeakerBio !== undefined) patch.campaign_speaker_bio = input.campaignSpeakerBio.trim() || null;
  if (input.campaignSpeakerImageUrl !== undefined) patch.campaign_speaker_image_url = input.campaignSpeakerImageUrl.trim() || null;
  if (input.featuredImageUrl !== undefined) patch.featured_image_url = input.featuredImageUrl.trim() || null;
  if (input.isFeatured !== undefined) patch.featured = input.isFeatured;
  if (input.isHighlighted !== undefined) patch.is_highlighted = input.isHighlighted;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.displayStartDate !== undefined) patch.display_start_date = input.displayStartDate || null;
  if (input.linkedExperienceId !== undefined) patch.linked_experience_id = input.linkedExperienceId;

  const { data, error } = await supabase.from("lessons").update(patch).eq("id", lessonId).select(LESSON_SELECT).single();
  if (error) throw error;
  return mapLesson(data);
}
