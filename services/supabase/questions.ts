import type { SupabaseClient } from "@supabase/supabase-js";
import { LessonQuestion } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapQuestion(row: any): LessonQuestion {
  return { id: row.id, question: row.question, sortOrder: row.sort_order ?? 0 };
}

// Replaces the full set of questions for a lesson. Delete-then-insert, same reasoning as
// replaceLessonExperiences -- no externally-referenced id depends on a question row surviving an
// edit in this phase (no completion-tracking references these ids yet; that's Phase 4's job).
export async function replaceLessonQuestions(supabase: SupabaseClient, lessonId: string, questions: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from("lesson_questions").delete().eq("lesson_id", lessonId);
  if (deleteError) throw deleteError;

  const trimmed = questions.map((q) => q.trim()).filter(Boolean);
  if (trimmed.length === 0) return;
  const { error: insertError } = await supabase
    .from("lesson_questions")
    .insert(trimmed.map((question, i) => ({ lesson_id: lessonId, question, sort_order: i })));
  if (insertError) throw insertError;
}
