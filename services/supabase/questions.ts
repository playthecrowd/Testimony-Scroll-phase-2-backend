import type { SupabaseClient } from "@supabase/supabase-js";
import { LessonQuestion } from "@/types";

interface EditQuestionRow {
  question_id: string;
  question: string;
  sort_order: number | null;
  choice_id: string | null;
  answer_text: string | null;
  choice_sort_order: number | null;
  is_correct: boolean | null;
}

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

// The only read path that ever sees is_correct client-side (besides the answer-check RPC, which
// returns just a boolean). Migration 0043 revoked column-level SELECT on is_correct for
// anon/authenticated, so this goes through a SECURITY DEFINER function instead of a plain nested
// select -- it re-checks private.is_church_manager internally, returning zero rows for anyone who
// doesn't manage this lesson (never an error, matching this codebase's existing RLS fail-closed
// convention). Never call this for member-facing rendering -- use the lesson's own embedded
// `questions` (via getLessonById/getLessonBySlug) for that, where every choice's isCorrect is
// always false.
export async function getLessonQuestionsForEdit(supabase: SupabaseClient, lessonId: string): Promise<LessonQuestion[]> {
  const { data, error } = await supabase.rpc("get_lesson_questions_for_edit", { p_lesson_id: lessonId });
  if (error) throw error;

  const byQuestion = new Map<string, LessonQuestion>();
  (data as EditQuestionRow[] | null ?? []).forEach((row) => {
    let q = byQuestion.get(row.question_id);
    if (!q) {
      q = { id: row.question_id, question: row.question, sortOrder: row.sort_order ?? 0, choices: [] };
      byQuestion.set(row.question_id, q);
    }
    if (row.choice_id) {
      q.choices.push({
        id: row.choice_id,
        answerText: row.answer_text ?? "",
        sortOrder: row.choice_sort_order ?? 0,
        isCorrect: row.is_correct ?? false,
      });
    }
  });

  return Array.from(byQuestion.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((q) => ({ ...q, choices: q.choices.slice().sort((a, b) => a.sortOrder - b.sortOrder) }));
}

// Member-facing answer submission. Sends only the three ids the learner actually chose -- never a
// client-computed "correct" flag -- and the RPC (migration 0043, SECURITY DEFINER) is the only
// thing that ever compares against is_correct, returning solely this boolean. The lesson_questions
// lookup here is a defense-in-depth check ("this question belongs to that lesson") on top of what
// the RPC's own join already scopes -- a fabricated/mismatched pair fails clearly instead of the
// mismatch being silently ignored.
export async function checkLessonQuestionAnswer(
  supabase: SupabaseClient,
  lessonId: string,
  questionId: string,
  choiceId: string
): Promise<boolean> {
  const { data: question, error: questionError } = await supabase
    .from("lesson_questions")
    .select("lesson_id")
    .eq("id", questionId)
    .maybeSingle();
  if (questionError) throw questionError;
  if (!question || question.lesson_id !== lessonId) {
    throw new Error("This question doesn't belong to the specified lesson.");
  }

  const { data, error } = await supabase.rpc("check_lesson_question_answer", {
    p_question_id: questionId,
    p_choice_id: choiceId,
  });
  if (error) throw error;
  return data === true;
}
