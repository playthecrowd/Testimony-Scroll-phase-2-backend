import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Regression guard for the secure member-facing answer flow (Phase C item 3): is_correct must
// never be readable by anon/authenticated except through the two SECURITY DEFINER functions
// added in migration 0043, and the app's own query shapes must never re-widen that back open.
// No live Supabase project is wired into `npm test` in this environment (see
// tests/rlsChurchIsolation.test.ts's own note), so this is a static source-scan substitute for a
// true "read is_correct directly via REST and confirm it's denied" integration test.

const ROOT = path.join(__dirname, "..");
const migration0043 = readFileSync(
  path.join(ROOT, "supabase", "migrations", "0043_lesson_question_choices_secure_answers.sql"),
  "utf8"
);
const lessonsService = readFileSync(path.join(ROOT, "services", "supabase", "lessons.ts"), "utf8");
const questionsService = readFileSync(path.join(ROOT, "services", "supabase", "questions.ts"), "utf8");
const lessonDetailClient = readFileSync(path.join(ROOT, "app", "lessons", "[lessonId]", "LessonDetailClient.tsx"), "utf8");
const lessonDetailPage = readFileSync(path.join(ROOT, "app", "lessons", "[lessonId]", "page.tsx"), "utf8");
const studiedClient = readFileSync(
  path.join(ROOT, "app", "journey", "[lessonId]", "studied", "StudiedClient.tsx"),
  "utf8"
);

test("[SOURCE SCAN] migration 0043 revokes plain SELECT on lesson_question_choices from anon/authenticated", () => {
  assert.match(migration0043, /revoke select on public\.lesson_question_choices from anon, authenticated/i);
});

test("[SOURCE SCAN] migration 0043's column-level re-grant excludes is_correct", () => {
  const grantMatch = migration0043.match(
    /grant select \(([^)]+)\)\s*\n\s*on public\.lesson_question_choices to anon, authenticated/i
  );
  assert.ok(grantMatch, "expected a column-scoped SELECT grant on lesson_question_choices");
  const columns = grantMatch![1].split(",").map((c) => c.trim());
  assert.ok(!columns.includes("is_correct"), `is_correct must not be in the public column grant: ${columns.join(", ")}`);
  assert.ok(columns.includes("answer_text"), "answer_text must stay publicly readable for study rendering");
});

test("[SOURCE SCAN] check_lesson_question_answer is SECURITY DEFINER and returns only a boolean", () => {
  const fnMatch = migration0043.match(/create or replace function public\.check_lesson_question_answer[\s\S]*?\$\$;/i);
  assert.ok(fnMatch, "expected check_lesson_question_answer to be defined");
  const body = fnMatch![0];
  assert.match(body, /returns boolean/i);
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path = ''/i);
  // Never selects/returns answer_text or other choices' data -- only compares is_correct
  // internally and returns the single boolean.
  assert.doesNotMatch(body, /select\s+c\.answer_text/i);
});

test("[SOURCE SCAN] get_lesson_questions_for_edit requires private.is_church_manager", () => {
  const fnMatch = migration0043.match(/create or replace function public\.get_lesson_questions_for_edit[\s\S]*?\$\$;/i);
  assert.ok(fnMatch, "expected get_lesson_questions_for_edit to be defined");
  const body = fnMatch![0];
  assert.match(body, /security definer/i);
  assert.match(body, /private\.is_church_manager/i);
});

test("[SOURCE SCAN] both new functions are granted execute to authenticated only, never anon/public", () => {
  const grants = migration0043.match(/grant execute on function[^;]+;/gi) ?? [];
  assert.ok(grants.length >= 2, "expected an execute grant for each new function");
  for (const g of grants) {
    const toClause = g.match(/to\s+([^;]+);/i)?.[1] ?? "";
    assert.match(toClause, /\bauthenticated\b/i);
    assert.doesNotMatch(toClause, /\banon\b/i);
    assert.doesNotMatch(toClause, /\bpublic\b/i);
  }
});

test("[SOURCE SCAN] LESSON_SELECT (member-facing lesson fetch) never selects is_correct", () => {
  const selectMatch = lessonsService.match(/const LESSON_SELECT = `[\s\S]*?`;/);
  assert.ok(selectMatch, "expected LESSON_SELECT to be defined");
  assert.doesNotMatch(selectMatch![0], /is_correct/);
});

test("[SOURCE SCAN] getLessonQuestionsForEdit (the only client-side reader of is_correct) goes through the RPC, not a plain nested select", () => {
  const fnMatch = questionsService.match(/export async function getLessonQuestionsForEdit[\s\S]*?\n}/);
  assert.ok(fnMatch, "expected getLessonQuestionsForEdit to be defined");
  assert.match(fnMatch![0], /\.rpc\("get_lesson_questions_for_edit"/);
});

test("[SOURCE SCAN] checkLessonQuestionAnswer sends only lessonId/questionId/choiceId -- never a client-computed correctness flag", () => {
  const fnMatch = questionsService.match(/export async function checkLessonQuestionAnswer[\s\S]*?\n}/);
  assert.ok(fnMatch, "expected checkLessonQuestionAnswer to be defined");
  const body = fnMatch![0];
  assert.match(body, /\.rpc\("check_lesson_question_answer"/);
  assert.doesNotMatch(body, /is_correct\s*:/);
  assert.doesNotMatch(body, /correct\s*:\s*true/i);
});

test("[SOURCE SCAN] the public lesson detail page no longer renders lesson.questions anywhere", () => {
  assert.doesNotMatch(lessonDetailClient, /lesson\.questions/);
  assert.doesNotMatch(lessonDetailClient, /"Questions"/);
});

// A client component's props are still serialized into the page's RSC payload regardless of
// whether its JSX reads a given field -- removing the *rendering* of questions above isn't
// enough on its own. Live verification (curling the built page) confirmed question/choice text
// was present in the HTML until the server page overrode questions to [] before handing the
// lesson to the client component; this guards that override from silently being lost.
test("[SOURCE SCAN] the lesson detail page overrides questions to an empty array before handing the lesson to the client component", () => {
  assert.match(lessonDetailPage, /questions:\s*\[\]/);
});

test("[SOURCE SCAN] StudiedClient's answer submission always calls the server check, never trusts choice.isCorrect", () => {
  assert.match(studiedClient, /checkLessonQuestionAnswer\(/);
  // The member-facing choice objects still carry an isCorrect field (always false, per
  // mapQuestion's default) for type-shape compatibility with the host-editing path -- this
  // asserts the Study flow's own submit logic never branches on it.
  assert.doesNotMatch(studiedClient, /\.isCorrect/);
});

test("[SOURCE SCAN] a correct answer only ever flips the aggregate 'questions' item true, never false, from the answer-submit path", () => {
  const submitFn = studiedClient.match(/async function submitAnswer[\s\S]*?\n {2}\}/);
  assert.ok(submitFn, "expected submitAnswer to be defined");
  assert.doesNotMatch(submitFn![0], /setChecklistItemCompletion/);
});
