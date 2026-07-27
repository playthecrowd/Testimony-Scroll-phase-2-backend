import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvText,
  generateRegularLessonCsvTemplate,
  parseAndValidateRegularLessonCsv,
  validateRegularLessonRow,
  REGULAR_LESSON_CSV_COLUMNS,
} from "../lib/regularLessonCsv";

test("[TRUE TEST] the downloadable template's header round-trips through the parser and matches every declared column", () => {
  const template = generateRegularLessonCsvTemplate();
  const rows = parseCsvText(template);
  assert.equal(rows.length, 2, "expected a header row plus one example row");
  const header = rows[0];
  for (const col of REGULAR_LESSON_CSV_COLUMNS) {
    assert.ok(header.includes(col.header), `template header is missing "${col.header}"`);
  }
});

test("[TRUE TEST] the template's own example row passes validation with zero errors", () => {
  const { rows, headerErrors } = parseAndValidateRegularLessonCsv(generateRegularLessonCsvTemplate());
  assert.deepEqual(headerErrors, []);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].errors, [], "the template's own example data should be valid, not just its header shape");
  assert.ok(rows[0].input);
});

test("[TRUE TEST] the template does NOT include any campaign-only column (Campaign Name, Month, Week Number, Monthly Theme, etc.)", () => {
  const headers = REGULAR_LESSON_CSV_COLUMNS.map((c) => c.header);
  for (const campaignOnly of ["Campaign Name", "Sprint/Season", "Month", "Month Number (1-12)", "Week Number", "Monthly Theme", "Monthly Bible Verse"]) {
    assert.ok(!headers.includes(campaignOnly), `Regular lesson CSV should never include the campaign-only column "${campaignOnly}"`);
  }
});

test("[TRUE TEST] only Lesson Title is required -- a row with just a title and nothing else validates cleanly", () => {
  const { input, errors } = validateRegularLessonRow({ lesson_title: "A Minimal Lesson" });
  assert.deepEqual(errors, []);
  assert.ok(input);
  assert.equal(input!.title, "A Minimal Lesson");
});

test("[TRUE TEST] a row missing Lesson Title is rejected with a specific error", () => {
  const { input, errors } = validateRegularLessonRow({ lesson_summary: "no title given" });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Lesson Title")));
});

test("[TRUE TEST] a CSV missing an expected column header is rejected before any row is even parsed for data", () => {
  const { rows, headerErrors } = parseAndValidateRegularLessonCsv("Lesson Title\nA Lesson\n");
  assert.equal(rows.length, 0);
  assert.ok(headerErrors.length > 0);
});

test("[TRUE TEST] row numbers reported match the row's real position in the uploaded file (header = row 1)", () => {
  const header = REGULAR_LESSON_CSV_COLUMNS.map((c) => c.header).join(",");
  const row1 = REGULAR_LESSON_CSV_COLUMNS.map((c) => (c.key === "lesson_title" ? "Week 1 Lesson" : "")).join(",");
  const row2 = REGULAR_LESSON_CSV_COLUMNS.map((c) => (c.key === "lesson_summary" ? "Has content but no title" : "")).join(","); // missing title -> error
  const csv = `${header}\n${row1}\n${row2}\n`;
  const { rows } = parseAndValidateRegularLessonCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rowNumber, 2);
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[1].rowNumber, 3);
  assert.ok(rows[1].errors.length > 0);
});

// ---- Background/Video/Slides URL columns (same rules as the Campaign Lesson CSV) ----

test("[TRUE TEST] Background Image URL, Video URL, and Slides URL are all optional", () => {
  const { input, media, errors } = validateRegularLessonRow({ lesson_title: "Test" });
  assert.deepEqual(errors, []);
  assert.equal(input!.backgroundImageUrl, "");
  assert.deepEqual(media, []);
});

test("[TRUE TEST] a row with Video URL and Slides URL populated produces both entries in media", () => {
  const { media, errors } = validateRegularLessonRow({
    lesson_title: "Test",
    video_url: "https://example.com/video.mp4",
    slides_url: "https://example.com/slides.pdf",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(media, [
    { mediaType: "video", url: "https://example.com/video.mp4" },
    { mediaType: "slides", url: "https://example.com/slides.pdf" },
  ]);
});

test("[TRUE TEST] an invalid Background Image URL is rejected with a specific error", () => {
  const { input, errors } = validateRegularLessonRow({ lesson_title: "Test", background_image_url: "not a url" });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Background Image URL")));
});

test("[TRUE TEST] an invalid Video URL is rejected with a specific error", () => {
  const { input, errors } = validateRegularLessonRow({ lesson_title: "Test", video_url: "not a url" });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Video URL")));
});

test("[TRUE TEST] an invalid Slides URL is rejected with a specific error", () => {
  const { input, errors } = validateRegularLessonRow({ lesson_title: "Test", slides_url: "not a url" });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Slides URL")));
});

// ---- Questions (same rules as the Campaign Lesson CSV -- shared validation logic shape) ----

test("[TRUE TEST] a complete question resolves its right answer by position number", () => {
  const { questions, errors } = validateRegularLessonRow({
    lesson_title: "Test",
    question_1: "What does this teach us?",
    question_1_answer_1: "A",
    question_1_answer_2: "B",
    question_1_answer_3: "C",
    question_1_answer_4: "D",
    question_1_right_answer: "2",
  });
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
  assert.deepEqual(
    questions[0].choices.map((c) => c.isCorrect),
    [false, true, false, false]
  );
});

test("[TRUE TEST] a question missing one of its 4 answers is rejected", () => {
  const { input, errors } = validateRegularLessonRow({
    lesson_title: "Test",
    question_1: "Incomplete?",
    question_1_answer_1: "A",
    question_1_answer_2: "B",
    question_1_answer_3: "C",
    question_1_right_answer: "1",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("all 4 answer choices")));
});

test("[TRUE TEST] a right answer that matches neither a position nor any answer text is rejected", () => {
  const { input, errors } = validateRegularLessonRow({
    lesson_title: "Test",
    question_1: "Q?",
    question_1_answer_1: "A",
    question_1_answer_2: "B",
    question_1_answer_3: "C",
    question_1_answer_4: "D",
    question_1_right_answer: "Z",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("must be 1-4 or match")));
});

// ---- Published flag ----

test("[TRUE TEST] Published defaults to false when omitted, and parses common truthy spellings", () => {
  const { input: defaultInput } = validateRegularLessonRow({ lesson_title: "Test" });
  assert.equal(defaultInput!.published, false);

  const { input: trueInput } = validateRegularLessonRow({ lesson_title: "Test", published: "TRUE" });
  assert.equal(trueInput!.published, true);
});
