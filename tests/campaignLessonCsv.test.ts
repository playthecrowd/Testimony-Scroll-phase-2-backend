import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvText,
  generateCampaignLessonCsvTemplate,
  parseAndValidateCampaignLessonCsv,
  validateCampaignLessonRow,
  CAMPAIGN_LESSON_CSV_COLUMNS,
} from "../lib/campaignLessonCsv";

test("[TRUE TEST] parseCsvText splits plain comma-separated rows", () => {
  const rows = parseCsvText("a,b,c\n1,2,3\n");
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "2", "3"],
  ]);
});

test("[TRUE TEST] parseCsvText keeps a comma inside a quoted field as one cell, not a split", () => {
  const rows = parseCsvText('title,summary\n"Call to Follow","Jesus calls us, and we respond."\n');
  assert.deepEqual(rows, [
    ["title", "summary"],
    ["Call to Follow", "Jesus calls us, and we respond."],
  ]);
});

test("[TRUE TEST] parseCsvText keeps an embedded newline inside a quoted field as one cell", () => {
  const rows = parseCsvText('title,notes\n"Week 1","Line one\nLine two"\n');
  assert.deepEqual(rows, [
    ["title", "notes"],
    ["Week 1", "Line one\nLine two"],
  ]);
});

test("[TRUE TEST] parseCsvText unescapes doubled quotes inside a quoted field", () => {
  const rows = parseCsvText('title\n"He said ""go""."\n');
  assert.deepEqual(rows, [["title"], ['He said "go".']]);
});

test("[TRUE TEST] parseCsvText handles CRLF line endings (Excel's default export)", () => {
  const rows = parseCsvText("a,b\r\n1,2\r\n");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("the downloadable template's header round-trips through the parser and matches every declared column", () => {
  const template = generateCampaignLessonCsvTemplate();
  const rows = parseCsvText(template);
  assert.equal(rows.length, 2, "expected a header row plus one example row");
  const header = rows[0];
  for (const col of CAMPAIGN_LESSON_CSV_COLUMNS) {
    assert.ok(header.includes(col.header), `template header is missing "${col.header}"`);
  }
});

test("the template's own example row passes validation with zero errors", () => {
  const { rows, headerErrors } = parseAndValidateCampaignLessonCsv(generateCampaignLessonCsvTemplate());
  assert.deepEqual(headerErrors, []);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].errors, [], "the template's own example data should be valid, not just its header shape");
  assert.ok(rows[0].input);
});

test("[TRUE TEST] a row missing a required field is rejected with a specific error, not silently accepted", () => {
  const { input, errors } = validateCampaignLessonRow({ campaign_name: "", month: "September", month_number: "1", week_number: "1", lesson_title: "Test" });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Campaign Name")));
});

test("[TRUE TEST] month_number out of range (1-12) is rejected", () => {
  const { input, errors } = validateCampaignLessonRow({
    campaign_name: "Kingdom Harvest", month: "September", month_number: "13", week_number: "1", lesson_title: "Test",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("1 to 12")));
});

test("[TRUE TEST] week_number out of range (1-5) is rejected", () => {
  const { input, errors } = validateCampaignLessonRow({
    campaign_name: "Kingdom Harvest", month: "September", month_number: "1", week_number: "0", lesson_title: "Test",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("1 to 5")));
});

test("[TRUE TEST] a non-numeric month_number is rejected rather than silently coerced", () => {
  const { input, errors } = validateCampaignLessonRow({
    campaign_name: "Kingdom Harvest", month: "September", month_number: "abc", week_number: "1", lesson_title: "Test",
  });
  assert.equal(input, null);
  assert.ok(errors.length > 0);
});

test("[TRUE TEST] a malformed display_start_date is rejected", () => {
  const { input, errors } = validateCampaignLessonRow({
    campaign_name: "Kingdom Harvest", month: "September", month_number: "1", week_number: "1", lesson_title: "Test",
    display_start_date: "09/01/2026",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("YYYY-MM-DD")));
});

test("[TRUE TEST] is_featured/is_highlighted parse common truthy spellings, default to false otherwise", () => {
  const { input } = validateCampaignLessonRow({
    campaign_name: "Kingdom Harvest", month: "September", month_number: "1", week_number: "1", lesson_title: "Test",
    is_featured: "TRUE", is_highlighted: "yes",
  });
  assert.equal(input!.isFeatured, true);
  assert.equal(input!.isHighlighted, true);

  const { input: input2 } = validateCampaignLessonRow({
    campaign_name: "Kingdom Harvest", month: "September", month_number: "1", week_number: "1", lesson_title: "Test",
    is_featured: "", is_highlighted: "nope",
  });
  assert.equal(input2!.isFeatured, false);
  assert.equal(input2!.isHighlighted, false);
});

test("a CSV missing an expected column header is rejected before any row is even parsed for data", () => {
  const { rows, headerErrors } = parseAndValidateCampaignLessonCsv("Campaign Name,Month\nKingdom Harvest,September\n");
  assert.equal(rows.length, 0);
  assert.ok(headerErrors.length > 0);
  assert.ok(headerErrors.some((e) => e.includes("Lesson Title")));
});

test("row numbers reported to the admin match the row's real position in the uploaded file (header = row 1)", () => {
  // Header built from the live column list (not hand-typed) so this test doesn't go stale every
  // time a column is added -- e.g. the 30 question/answer columns added alongside this test.
  const header = CAMPAIGN_LESSON_CSV_COLUMNS.map((c) => c.header).join(",");
  const blankRow = CAMPAIGN_LESSON_CSV_COLUMNS.map(() => "").join(",");
  const row1 = CAMPAIGN_LESSON_CSV_COLUMNS.map((c) => {
    if (c.key === "campaign_name") return "Kingdom Harvest";
    if (c.key === "month") return "September";
    if (c.key === "month_number") return "1";
    if (c.key === "week_number") return "1";
    if (c.key === "lesson_title") return "Week 1 Lesson";
    return "";
  }).join(",");
  // second data row: missing week_number and lesson_title
  const row2 = CAMPAIGN_LESSON_CSV_COLUMNS.map((c) => {
    if (c.key === "campaign_name") return "Kingdom Harvest";
    if (c.key === "month") return "September";
    if (c.key === "month_number") return "1";
    return "";
  }).join(",");
  const csv = `${header}\n${row1}\n${row2}\n`;
  const { rows } = parseAndValidateCampaignLessonCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rowNumber, 2);
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[1].rowNumber, 3);
  assert.ok(rows[1].errors.length > 0);
  assert.deepEqual(parseCsvText(blankRow), [], "sanity: a fully-blank row is dropped by the parser itself");
});

// ---- Study question columns (host/admin-authored multiple-choice reference answers) ----

const BASE_ROW = { campaign_name: "Kingdom Harvest", month: "September", month_number: "1", week_number: "1", lesson_title: "Test" };

test("[TRUE TEST] a row with no question text imports with zero questions and no question-related errors", () => {
  const { input, questions, errors } = validateCampaignLessonRow({ ...BASE_ROW });
  assert.ok(input);
  assert.deepEqual(questions, []);
  assert.deepEqual(errors, []);
});

test("[TRUE TEST] a complete question resolves its right answer by position number (1-4)", () => {
  const { questions, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_1: "What does this teach us?",
    question_1_answer_1: "Faithfulness",
    question_1_answer_2: "Nothing",
    question_1_answer_3: "Doubt",
    question_1_answer_4: "Fear",
    question_1_right_answer: "1",
  });
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].question, "What does this teach us?");
  assert.deepEqual(
    questions[0].choices.map((c) => c.isCorrect),
    [true, false, false, false]
  );
});

test("[TRUE TEST] a complete question resolves its right answer by case-insensitive text match", () => {
  const { questions, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_1: "What does this teach us?",
    question_1_answer_1: "Faithfulness",
    question_1_answer_2: "Nothing",
    question_1_answer_3: "Doubt",
    question_1_answer_4: "Fear",
    question_1_right_answer: "doubt",
  });
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
  assert.deepEqual(
    questions[0].choices.map((c) => c.isCorrect),
    [false, false, true, false]
  );
});

test("[TRUE TEST] a question missing one of its 4 answers is rejected with a specific row error", () => {
  const { input, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_1: "What does this teach us?",
    question_1_answer_1: "Faithfulness",
    question_1_answer_2: "Nothing",
    question_1_answer_3: "Doubt",
    // answer 4 left blank
    question_1_right_answer: "1",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("all 4 answer choices")));
});

test("[TRUE TEST] a question with 4 answers but no right answer is rejected", () => {
  const { input, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_1: "What does this teach us?",
    question_1_answer_1: "Faithfulness",
    question_1_answer_2: "Nothing",
    question_1_answer_3: "Doubt",
    question_1_answer_4: "Fear",
    // right answer left blank
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("right answer is required")));
});

test("[TRUE TEST] a right answer that matches neither a position number nor any answer text is rejected", () => {
  const { input, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_1: "What does this teach us?",
    question_1_answer_1: "Faithfulness",
    question_1_answer_2: "Nothing",
    question_1_answer_3: "Doubt",
    question_1_answer_4: "Fear",
    question_1_right_answer: "Hope",
  });
  assert.equal(input, null);
  assert.ok(errors.some((e) => e.includes("Question 1") && e.includes("must be 1-4 or match")));
});

test("[TRUE TEST] Question 5 (the last of the 5-question cap) validates and imports correctly", () => {
  const { questions, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_5: "Final question?",
    question_5_answer_1: "A",
    question_5_answer_2: "B",
    question_5_answer_3: "C",
    question_5_answer_4: "D",
    question_5_right_answer: "4",
  });
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].question, "Final question?");
  assert.deepEqual(
    questions[0].choices.map((c) => c.isCorrect),
    [false, false, false, true]
  );
});

test("[TRUE TEST] multiple questions (1 and 3) in the same row are both parsed independently", () => {
  const { questions, errors } = validateCampaignLessonRow({
    ...BASE_ROW,
    question_1: "Q1?",
    question_1_answer_1: "A1",
    question_1_answer_2: "A2",
    question_1_answer_3: "A3",
    question_1_answer_4: "A4",
    question_1_right_answer: "2",
    question_3: "Q3?",
    question_3_answer_1: "B1",
    question_3_answer_2: "B2",
    question_3_answer_3: "B3",
    question_3_answer_4: "B4",
    question_3_right_answer: "3",
  });
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].question, "Q1?");
  assert.equal(questions[1].question, "Q3?");
});
