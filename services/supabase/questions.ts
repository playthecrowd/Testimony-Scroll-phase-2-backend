import type { SupabaseClient } from "@supabase/supabase-js";
import { LessonQuestion } from "@/types";

// A question is either legacy-plain (choices: []) or multiple-choice (choices.length === 4,
// exactly one isCorrect) -- the service layer is the last line of defense for that invariant
// before a write reaches the DB, which only enforces "at most one correct" (see migration
// 0039_lesson_question_choices.sql for why "exactly one" isn't DB-enforced).
export interface QuestionInput {
  question: string;
  choices: { answerText: string; isCorrect: boolean }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapQuestion(row: any): LessonQuestion {
  return {
    id: row.id,
    question: row.question,
    sortOrder: row.sort_order ?? 0,
    choices: (row.choices ?? [])
      .slice()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({ id: c.id, answerText: c.answer_text, sortOrder: c.sort_order ?? 0, isCorrect: c.is_correct ?? false })),
  };
}

// Replaces the full set of questions (and each question's answer choices) for a lesson.
// Delete-then-insert, same reasoning as replaceLessonExperiences -- no externally-referenced id
// depends on a question row surviving an edit in this phase (no completion-tracking references
// these ids yet; that's a later phase's job). Deleting lesson_questions cascades to
// lesson_question_choices via its FK, so no separate choices delete is needed.
export async function replaceLessonQuestions(supabase: SupabaseClient, lessonId: string, questions: QuestionInput[]): Promise<void> {
  const { error: deleteError } = await supabase.from("lesson_questions").delete().eq("lesson_id", lessonId);
  if (deleteError) throw deleteError;

  const trimmed = questions
    .map((q) => ({ question: q.question.trim(), choices: q.choices }))
    .filter((q) => q.question.length > 0);
  if (trimmed.length === 0) return;

  const { data: inserted, error: insertError } = await supabase
    .from("lesson_questions")
    .insert(trimmed.map((q, i) => ({ lesson_id: lessonId, question: q.question, sort_order: i })))
    .select("id");
  if (insertError) throw insertError;

  // A single multi-row INSERT ... RETURNING preserves VALUES-list order in Postgres -- same
  // reliance createCampaignLessonsBatch already documents for its own batch insert -- so
  // inserted[i] corresponds to trimmed[i].
  const choiceRows = trimmed.flatMap((q, i) => {
    if (q.choices.length !== 4) return [];
    return q.choices.map((c, ci) => ({
      question_id: inserted![i].id,
      answer_text: c.answerText.trim(),
      sort_order: ci,
      is_correct: c.isCorrect,
    }));
  });
  if (choiceRows.length === 0) return;

  const { error: choicesError } = await supabase.from("lesson_question_choices").insert(choiceRows);
  if (choicesError) throw choicesError;
}
