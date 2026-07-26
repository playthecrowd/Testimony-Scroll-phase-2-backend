"use client";

import { Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { LessonQuestion } from "@/types";
import { QuestionInput } from "@/services/supabase/questions";

const MAX_QUESTIONS = 5;
const CHOICE_COUNT = 4;

// Manual-only question authoring (docs/PHASE3_AUDIT.md section 3b) -- no auto-generated
// suggestions, that would need the AI/content-extraction pipeline, deferred to its own later
// phase. Each question now carries exactly 4 answer choices with one marked correct
// (host/admin-authored reference answer, not member-submitted -- see migration
// 0039_lesson_question_choices.sql). The backend (replaceLessonQuestions) always replaces the
// full set for a lesson, so there's no row identity to preserve across a save the way
// lesson_media's diff needs to -- this draft shape has no ids.
export interface QuestionDraft {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number | null;
}

function emptyDraft(): QuestionDraft {
  return { question: "", choices: ["", "", "", ""], correctIndex: null };
}

interface QuestionsEditorProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
  disabled?: boolean;
}

export function QuestionsEditor({ questions, onChange, disabled }: QuestionsEditorProps) {
  function updateQuestion(index: number, value: string) {
    onChange(questions.map((q, i) => (i === index ? { ...q, question: value } : q)));
  }

  function updateChoice(index: number, choiceIndex: number, value: string) {
    onChange(
      questions.map((q, i) => {
        if (i !== index) return q;
        const choices = [...q.choices] as [string, string, string, string];
        choices[choiceIndex] = value;
        return { ...q, choices };
      })
    );
  }

  function setCorrect(index: number, choiceIndex: number) {
    onChange(questions.map((q, i) => (i === index ? { ...q, correctIndex: choiceIndex } : q)));
  }

  function removeAt(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveAt(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = questions.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    onChange([...questions, emptyDraft()]);
  }

  return (
    <div className="space-y-4">
      {questions.map((q, index) => (
        <div key={index} className="rounded-lg border border-border-subtle p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted mt-2.5 w-5 shrink-0">{index + 1}.</span>
            <input
              value={q.question}
              onChange={(e) => updateQuestion(index, e.target.value)}
              placeholder="e.g., What does this passage teach us about God's faithfulness?"
              disabled={disabled}
              aria-label={`Question ${index + 1}`}
              className="qk-input flex-1"
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => moveAt(index, -1)}
                disabled={disabled || index === 0}
                aria-label="Move up"
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-muted"
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => moveAt(index, 1)}
                disabled={disabled || index === questions.length - 1}
                aria-label="Move down"
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-muted"
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label="Remove question"
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="pl-7 space-y-1.5">
            {q.choices.map((choice, choiceIndex) => (
              <div key={choiceIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-answer-${index}`}
                  checked={q.correctIndex === choiceIndex}
                  onChange={() => setCorrect(index, choiceIndex)}
                  disabled={disabled}
                  aria-label={`Mark answer ${choiceIndex + 1} as correct for question ${index + 1}`}
                  className="shrink-0"
                />
                <input
                  value={choice}
                  onChange={(e) => updateChoice(index, choiceIndex, e.target.value)}
                  placeholder={`Answer ${choiceIndex + 1}`}
                  disabled={disabled}
                  aria-label={`Question ${index + 1} answer ${choiceIndex + 1}`}
                  className="qk-input flex-1 text-sm"
                />
              </div>
            ))}
            <p className="text-[11px] text-muted">Select the circle next to the correct answer.</p>
          </div>
        </div>
      ))}

      {questions.length === 0 && (
        <p className="text-xs text-muted">No questions yet -- optional, but they help members reflect on the lesson.</p>
      )}

      <button
        type="button"
        onClick={addQuestion}
        disabled={disabled || questions.length >= MAX_QUESTIONS}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-blue-light hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={15} /> Add a question {questions.length > 0 && `(${questions.length}/${MAX_QUESTIONS})`}
      </button>
    </div>
  );
}

// ---- Pure helpers, shared by every save call site (experience-builder create/edit, campaign
// lesson form) so the "is this question set valid" and "draft <-> persisted shape" logic exists
// exactly once. ----

// A question row only "counts" once its question text is non-empty -- a fully-empty row is
// silently ignorable (never submitted, never an error). Once text is present, though, all 4
// choices and a chosen correct answer are required -- this mirrors the CSV import's rule ("if a
// question is provided, all 4 answers and the right answer are required") applied consistently to
// manual entry, so a host's partially-authored quiz question never silently vanishes on save.
export function validateQuestionDrafts(questions: QuestionDraft[]): string[] {
  const errors: string[] = [];
  if (questions.length > MAX_QUESTIONS) {
    errors.push(`A lesson can have at most ${MAX_QUESTIONS} questions.`);
  }
  questions.forEach((q, i) => {
    if (!q.question.trim()) return;
    const filledChoices = q.choices.filter((c) => c.trim().length > 0).length;
    if (filledChoices < CHOICE_COUNT) {
      errors.push(`Question ${i + 1}: all ${CHOICE_COUNT} answer choices are required.`);
    }
    if (q.correctIndex === null || !q.choices[q.correctIndex]?.trim()) {
      errors.push(`Question ${i + 1}: choose which answer is correct.`);
    }
  });
  return errors;
}

// Call only after validateQuestionDrafts returns no errors -- assumes every non-empty question is
// already complete.
export function toQuestionInputs(questions: QuestionDraft[]): QuestionInput[] {
  return questions
    .filter((q) => q.question.trim().length > 0)
    .map((q) => ({
      question: q.question.trim(),
      choices:
        q.correctIndex === null
          ? []
          : q.choices.map((text, i) => ({ answerText: text.trim(), isCorrect: i === q.correctIndex })),
    }));
}

export function questionsToDrafts(questions: LessonQuestion[]): QuestionDraft[] {
  return questions.map((q) => {
    if (q.choices.length !== CHOICE_COUNT) {
      // Legacy plain-text question with no choices -- seed 4 empty slots, no correct answer
      // chosen yet, so the editor can still show/re-author it without throwing.
      return { question: q.question, choices: ["", "", "", ""], correctIndex: null };
    }
    const sorted = q.choices.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const correctIndex = sorted.findIndex((c) => c.isCorrect);
    return {
      question: q.question,
      choices: sorted.map((c) => c.answerText) as [string, string, string, string],
      correctIndex: correctIndex === -1 ? null : correctIndex,
    };
  });
}
