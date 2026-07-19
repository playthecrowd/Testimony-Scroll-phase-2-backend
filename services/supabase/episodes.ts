import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishedEpisode, PublishedEpisodeStatus } from "@/types";

const EPISODE_SELECT = `
  id, season, episode_number, title, description, duration_label, topic, scripture,
  thumbnail_url, quote, quote_source, status, featured, release_date, created_at, updated_at,
  episode_characters(role_note, character:characters(id, name, image_url)),
  episode_lessons(lesson:lessons(id, title, slug))
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEpisode(row: any): PublishedEpisode {
  return {
    id: row.id,
    season: row.season,
    episodeNumber: row.episode_number,
    title: row.title,
    description: row.description,
    durationLabel: row.duration_label,
    topic: row.topic,
    scripture: row.scripture,
    thumbnailUrl: row.thumbnail_url,
    quote: row.quote,
    quoteSource: row.quote_source,
    status: row.status,
    featured: row.featured,
    releaseDate: row.release_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    characters: (row.episode_characters ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ec: any) => ec.character)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ec: any) => ({ id: ec.character.id, name: ec.character.name, imageUrl: ec.character.image_url, roleNote: ec.role_note })),
    lessons: (row.episode_lessons ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((el: any) => el.lesson)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((el: any) => ({ id: el.lesson.id, title: el.lesson.title, slug: el.lesson.slug })),
  };
}

// Deliberately no .eq("status", ...) filter -- same pattern as getManagedLessonsByChurch: RLS
// (episodes_select_published_or_admin) is what decides visibility, so a public visitor only ever
// gets published rows back and a platform admin gets everything, from this one query.
export async function getEpisodes(supabase: SupabaseClient): Promise<PublishedEpisode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select(EPISODE_SELECT)
    .order("season", { ascending: true })
    .order("episode_number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEpisode);
}

export async function getEpisodeById(supabase: SupabaseClient, id: string): Promise<PublishedEpisode | null> {
  const { data, error } = await supabase.from("episodes").select(EPISODE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapEpisode(data) : null;
}

export async function getEpisodesByCharacter(supabase: SupabaseClient, characterId: string): Promise<PublishedEpisode[]> {
  const { data, error } = await supabase
    .from("episode_characters")
    .select(`episode:episodes(${EPISODE_SELECT})`)
    .eq("character_id", characterId);
  if (error) throw error;
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((row: any) => row.episode)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => mapEpisode(row.episode));
}

export interface EpisodeInput {
  season: number;
  episodeNumber: number;
  title: string;
  description: string;
  durationLabel: string;
  topic: string;
  scripture: string;
  thumbnailUrl: string;
  quote: string;
  quoteSource: string;
  featured: boolean;
  releaseDate: string;
}

function toEpisodeRow(input: EpisodeInput) {
  return {
    season: input.season,
    episode_number: input.episodeNumber,
    title: input.title,
    description: input.description || null,
    duration_label: input.durationLabel || null,
    topic: input.topic || null,
    scripture: input.scripture || null,
    thumbnail_url: input.thumbnailUrl || null,
    quote: input.quote || null,
    quote_source: input.quoteSource || null,
    featured: input.featured,
    release_date: input.releaseDate || null,
  };
}

export async function createEpisode(supabase: SupabaseClient, input: EpisodeInput): Promise<PublishedEpisode> {
  const { data, error } = await supabase
    .from("episodes")
    .insert({ ...toEpisodeRow(input), status: "draft" })
    .select(EPISODE_SELECT)
    .single();
  if (error) throw error;
  return mapEpisode(data);
}

export async function updateEpisode(supabase: SupabaseClient, id: string, input: EpisodeInput): Promise<void> {
  const { error } = await supabase.from("episodes").update(toEpisodeRow(input)).eq("id", id);
  if (error) throw error;
}

export async function updateEpisodeStatus(supabase: SupabaseClient, id: string, status: PublishedEpisodeStatus): Promise<void> {
  const { error } = await supabase.from("episodes").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function replaceEpisodeCharacters(
  supabase: SupabaseClient,
  episodeId: string,
  entries: { characterId: string; roleNote: string | null }[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("episode_characters").delete().eq("episode_id", episodeId);
  if (deleteError) throw deleteError;
  if (entries.length === 0) return;
  const { error: insertError } = await supabase
    .from("episode_characters")
    .insert(entries.map((e) => ({ episode_id: episodeId, character_id: e.characterId, role_note: e.roleNote })));
  if (insertError) throw insertError;
}

export async function replaceEpisodeLessons(supabase: SupabaseClient, episodeId: string, lessonIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from("episode_lessons").delete().eq("episode_id", episodeId);
  if (deleteError) throw deleteError;
  if (lessonIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("episode_lessons")
    .insert(lessonIds.map((lessonId) => ({ episode_id: episodeId, lesson_id: lessonId })));
  if (insertError) throw insertError;
}
