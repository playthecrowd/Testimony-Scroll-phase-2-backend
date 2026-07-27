import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuestionDrafts, toQuestionInputs, questionsToDrafts, QuestionDraft } from "../components/lessons/QuestionsEditor";
import { LessonQuestion } from "../types";

function draft(overrides: Partial<QuestionDraft> = {}): QuestionDraft {
  return { question: "", choices: ["", "", "", ""], correctIndex: null, ...overrides };
}

test("[TRUE TEST] validateQuestionDrafts silently ignores a fully-empty row (no text, no choices)", () => {
  const errors = validateQuestionDrafts([draft()]);
  assert.deepEqual(errors, []);
});

test("[TRUE TEST] validateQuestionDrafts blocks a question with text but fewer than 4 filled choices", () => {
  const errors = validateQuestionDrafts([draft({ question: "Q1?", choices: ["A", "B", "", ""], correctIndex: 0 })]);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("4")));
});

test("[TRUE TEST] validateQuestionDrafts blocks a question with 4 choices but no correct answer chosen", () => {
  const errors = validateQuestionDrafts([draft({ question: "Q1?", choices: ["A", "B", "C", "D"], correctIndex: null })]);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("correct")));
});

test("[TRUE TEST] validateQuestionDrafts passes a fully-complete question", () => {
  const errors = validateQuestionDrafts([draft({ question: "Q1?", choices: ["A", "B", "C", "D"], correctIndex: 2 })]);
  assert.deepEqual(errors, []);
});

test("[TRUE TEST] validateQuestionDrafts rejects more than 5 questions", () => {
  const drafts = Array.from({ length: 6 }, (_, i) => draft({ question: `Q${i + 1}?`, choices: ["A", "B", "C", "D"], correctIndex: 0 }));
  const errors = validateQuestionDrafts(drafts);
  assert.ok(errors.some((e) => e.includes("at most 5")));
});

test("[TRUE TEST] toQuestionInputs drops fully-empty rows and maps correctIndex to isCorrect flags", () => {
  const inputs = toQuestionInputs([
    draft(),
    draft({ question: "Q1?", choices: ["A", "B", "C", "D"], correctIndex: 1 }),
  ]);
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].question, "Q1?");
  assert.deepEqual(
    inputs[0].choices.map((c) => c.isCorrect),
    [false, true, false, false]
  );
});

test("[TRUE TEST] questionsToDrafts round-trips a persisted question with 4 choices, preserving the correct index", () => {
  const persisted: LessonQuestion[] = [
    {
      id: "q1",
      question: "Q1?",
      sortOrder: 0,
      choices: [
        { id: "c1", answerText: "A", sortOrder: 0, isCorrect: false },
        { id: "c2", answerText: "B", sortOrder: 1, isCorrect: true },
        { id: "c3", answerText: "C", sortOrder: 2, isCorrect: false },
        { id: "c4", answerText: "D", sortOrder: 3, isCorrect: false },
      ],
    },
  ];
  const drafts = questionsToDrafts(persisted);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].question, "Q1?");
  assert.deepEqual(drafts[0].choices, ["A", "B", "C", "D"]);
  assert.equal(drafts[0].correctIndex, 1);
});

test("[TRUE TEST] questionsToDrafts gracefully handles a legacy plain-text question with zero choices", () => {
  const persisted: LessonQuestion[] = [{ id: "q1", question: "Legacy question?", sortOrder: 0, choices: [] }];
  const drafts = questionsToDrafts(persisted);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].question, "Legacy question?");
  assert.deepEqual(drafts[0].choices, ["", "", "", ""]);
  assert.equal(drafts[0].correctIndex, null);
});
