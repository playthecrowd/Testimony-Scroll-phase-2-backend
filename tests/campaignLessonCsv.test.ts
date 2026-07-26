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
  const csv =
    "Campaign Name,Sprint/Season,Month,Month Number (1-12),Week Number,Monthly Theme,Monthly Bible Verse,Lesson Title,Lesson Summary,Lesson Content/Notes,Weekly Verse (if available),Speaker Name,Speaker Bio,Speaker Image URL,Thumbnail/Image URL,Is Featured (true/false),Is Highlighted (true/false),Published (true/false),Sort Order,Display Start Date (YYYY-MM-DD),Linked Experience ID (optional)\n" +
    "Kingdom Harvest,,September,1,1,,,Week 1 Lesson,,,,,,,,,,,,,\n" +
    "Kingdom Harvest,,September,1,,,,,,,,,,,,,,,,,\n"; // second data row: missing week_number and lesson_title
  const { rows } = parseAndValidateCampaignLessonCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rowNumber, 2);
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[1].rowNumber, 3);
  assert.ok(rows[1].errors.length > 0);
});
