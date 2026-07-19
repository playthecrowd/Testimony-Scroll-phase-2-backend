"use client";

import { Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";

// Manual-only question authoring (docs/PHASE3_AUDIT.md section 3b) -- no auto-generated
// suggestions, that would need the AI/content-extraction pipeline, deferred to its own later
// phase. Operates on a plain string[] rather than id-tracked rows: the backend
// (replaceLessonQuestions) always replaces the full set for a lesson, so there's no row identity
// to preserve across a save the way lesson_media's diff needs to.
interface QuestionsEditorProps {
  questions: string[];
  onChange: (questions: string[]) => void;
  disabled?: boolean;
}

export function QuestionsEditor({ questions, onChange, disabled }: QuestionsEditorProps) {
  function updateAt(index: number, value: string) {
    onChange(questions.map((q, i) => (i === index ? value : q)));
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
    onChange([...questions, ""]);
  }

  return (
    <div className="space-y-2.5">
      {questions.map((question, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-xs text-muted mt-2.5 w-5 shrink-0">{index + 1}.</span>
          <input
            value={question}
            onChange={(e) => updateAt(index, e.target.value)}
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
      ))}

      {questions.length === 0 && (
        <p className="text-xs text-muted">No questions yet -- optional, but they help members reflect on the lesson.</p>
      )}

      <button
        type="button"
        onClick={addQuestion}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-blue-light hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={15} /> Add a question
      </button>
    </div>
  );
}
