import type { SupabaseClient } from "@supabase/supabase-js";
import { Experience } from "@/types";

const EXPERIENCE_SELECT = "id, name, description, preview_image_url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapExperience(row: any): Experience {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    previewImageUrl: row.preview_image_url,
  };
}

// The experiences catalog itself (docs/PHASE3_AUDIT.md section 3c) -- public, cross-church
// content. No admin write path exists yet (Phase 9); rows are seeded/added directly in Supabase.
export async function getExperiences(supabase: SupabaseClient): Promise<Experience[]> {
  const { data, error } = await supabase.from("experiences").select(EXPERIENCE_SELECT).order("name");
  if (error) throw error;
  return (data ?? []).map(mapExperience);
}

// Replaces the full set of experience selections for a lesson. Delete-then-insert rather than a
// precise diff (unlike lesson_media, no Storage object or externally-referenced id depends on
// these rows surviving across an edit, so there's no duplicate/orphan risk to guard against).
export async function replaceLessonExperiences(
  supabase: SupabaseClient,
  lessonId: string,
  selections: { experienceId: string; relationshipNote: string | null }[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("lesson_experiences").delete().eq("lesson_id", lessonId);
  if (deleteError) throw deleteError;

  if (selections.length === 0) return;
  const { error: insertError } = await supabase.from("lesson_experiences").insert(
    selections.map((s) => ({ lesson_id: lessonId, experience_id: s.experienceId, relationship_note: s.relationshipNote }))
  );
  if (insertError) throw insertError;
}
