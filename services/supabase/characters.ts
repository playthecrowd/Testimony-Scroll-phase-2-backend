import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishedCharacter, PublishedCharacterWithRelations } from "@/types";

const CHARACTER_SELECT = "id, name, role, description, image_url, quote, quote_source, is_key_character, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCharacter(row: any): PublishedCharacter {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    imageUrl: row.image_url,
    quote: row.quote,
    quoteSource: row.quote_source,
    isKeyCharacter: row.is_key_character,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCharacters(supabase: SupabaseClient): Promise<PublishedCharacter[]> {
  const { data, error } = await supabase
    .from("characters")
    .select(CHARACTER_SELECT)
    .order("is_key_character", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapCharacter);
}

export async function getCharacterById(supabase: SupabaseClient, id: string): Promise<PublishedCharacterWithRelations | null> {
  const { data, error } = await supabase.from("characters").select(CHARACTER_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // "Related Lessons" has no direct character_lessons table -- it's derived through the
  // character's own episodes, reusing episode_lessons (already built for the Episodes feature)
  // rather than adding a second, largely-duplicate join table for what's fundamentally the same
  // "this content relates to that lesson" relationship. A character with no episodes yet just
  // gets an empty relatedLessons array below.
  const [{ data: episodeLinks, error: episodesError }, { data: testimonyLinks, error: testimoniesError }] = await Promise.all([
    supabase
      .from("episode_characters")
      .select("episode:episodes(id, title, episode_number, season, episode_lessons(lesson:lessons(id, title, slug)))")
      .eq("character_id", id),
    supabase
      .from("character_testimonies")
      .select("note, testimony:testimonies(id, title)")
      .eq("character_id", id),
  ]);
  if (episodesError) throw episodesError;
  if (testimoniesError) throw testimoniesError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const episodeRows = (episodeLinks ?? []).filter((row: any) => row.episode);

  const relatedLessonsById = new Map<string, { id: string; title: string; slug: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of episodeRows as any[]) {
    for (const el of row.episode.episode_lessons ?? []) {
      if (el.lesson) relatedLessonsById.set(el.lesson.id, { id: el.lesson.id, title: el.lesson.title, slug: el.lesson.slug });
    }
  }

  return {
    ...mapCharacter(data),
    episodes: episodeRows.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => ({ id: row.episode.id, title: row.episode.title, episodeNumber: row.episode.episode_number, season: row.episode.season })
    ),
    testimonies: (testimonyLinks ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((row: any) => row.testimony)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => ({ id: row.testimony.id, title: row.testimony.title, note: row.note })),
    relatedLessons: Array.from(relatedLessonsById.values()),
  };
}

export interface CharacterInput {
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  quote: string;
  quoteSource: string;
  isKeyCharacter: boolean;
}

function toCharacterRow(input: CharacterInput) {
  return {
    name: input.name,
    role: input.role || null,
    description: input.description || null,
    image_url: input.imageUrl || null,
    quote: input.quote || null,
    quote_source: input.quoteSource || null,
    is_key_character: input.isKeyCharacter,
  };
}

export async function createCharacter(supabase: SupabaseClient, input: CharacterInput): Promise<PublishedCharacter> {
  const { data, error } = await supabase.from("characters").insert(toCharacterRow(input)).select(CHARACTER_SELECT).single();
  if (error) throw error;
  return mapCharacter(data);
}

export async function updateCharacter(supabase: SupabaseClient, id: string, input: CharacterInput): Promise<void> {
  const { error } = await supabase.from("characters").update(toCharacterRow(input)).eq("id", id);
  if (error) throw error;
}

// Delete-then-insert, same reasoning as Phase 3's replaceLessonExperiences -- no externally-
// referenced id depends on these rows surviving an edit.
export async function replaceCharacterTestimonies(
  supabase: SupabaseClient,
  characterId: string,
  entries: { testimonyId: string; note: string | null }[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("character_testimonies").delete().eq("character_id", characterId);
  if (deleteError) throw deleteError;

  if (entries.length === 0) return;
  const { error: insertError } = await supabase
    .from("character_testimonies")
    .insert(entries.map((e) => ({ character_id: characterId, testimony_id: e.testimonyId, note: e.note })));
  if (insertError) throw insertError;
}
