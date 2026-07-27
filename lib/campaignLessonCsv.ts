import { CampaignLessonInput } from "@/services/supabase/lessons";
import { QuestionInput } from "@/services/supabase/questions";
import { isValidMediaUrl } from "@/lib/lessonForm";

const MAX_CSV_QUESTIONS = 5;

// Bulk CSV import for Year-Round Campaign Lessons (Phase Two). Hand-rolled parser rather than a
// new npm dependency -- this repo has no CSV/Excel library installed, and the schema is small and
// fixed enough that a dependency isn't warranted for v1 (explicit owner decision: CSV only for
// now, native .xlsx import deferred). The template is a plain .csv file, which opens and edits
// fine in Excel -- the UI tells admins to save-as-CSV before re-uploading if they used Excel.

export interface CampaignLessonCsvColumn {
  key: string;
  header: string;
  required: boolean;
  example: string;
}

export const CAMPAIGN_LESSON_CSV_COLUMNS: CampaignLessonCsvColumn[] = [
  { key: "campaign_name", header: "Campaign Name", required: true, example: "Kingdom Harvest" },
  { key: "sprint_season", header: "Sprint/Season", required: false, example: "Year 1" },
  { key: "month", header: "Month", required: true, example: "September" },
  { key: "month_number", header: "Month Number (1-12)", required: true, example: "9" },
  { key: "week_number", header: "Week Number", required: true, example: "1" },
  { key: "monthly_theme", header: "Monthly Theme", required: false, example: "Call to Follow" },
  { key: "monthly_verse", header: "Monthly Bible Verse", required: false, example: "Matthew 4:19" },
  { key: "lesson_title", header: "Lesson Title", required: true, example: "Call to Follow" },
  { key: "lesson_summary", header: "Lesson Summary", required: false, example: "Jesus calls us to follow Him with purpose and belonging." },
  { key: "lesson_content", header: "Lesson Content/Notes", required: false, example: "Full lesson notes go here." },
  { key: "weekly_verse", header: "Weekly Verse (if available)", required: false, example: "Matthew 4:19-20" },
  { key: "speaker_name", header: "Speaker Name", required: false, example: "Pastor Jordan" },
  { key: "speaker_bio", header: "Speaker Bio", required: false, example: "Lead Pastor at Grace Community Church." },
  { key: "speaker_image_url", header: "Speaker Image URL", required: false, example: "https://example.com/speaker.jpg" },
  { key: "thumbnail_url", header: "Thumbnail/Image URL", required: false, example: "https://example.com/lesson.jpg" },
  { key: "background_image_url", header: "Background Image URL", required: false, example: "" },
  { key: "video_url", header: "Video URL", required: false, example: "" },
  { key: "slides_url", header: "Slides URL", required: false, example: "" },
  { key: "is_featured", header: "Is Featured (true/false)", required: false, example: "false" },
  { key: "is_highlighted", header: "Is Highlighted (true/false)", required: false, example: "false" },
  { key: "published", header: "Published (true/false)", required: false, example: "false" },
  { key: "sort_order", header: "Sort Order", required: false, example: "0" },
  { key: "display_start_date", header: "Display Start Date (YYYY-MM-DD)", required: false, example: "2026-09-01" },
  { key: "linked_experience_id", header: "Linked Experience ID (optional)", required: false, example: "" },
  // Study questions are entirely optional per-row (required: false at the column level) -- the
  // generic required-field loop below has no "required if this other column is filled" concept,
  // so per-question completeness is checked separately in validateCampaignLessonRow.
  ...Array.from({ length: MAX_CSV_QUESTIONS }, (_, i): CampaignLessonCsvColumn[] => {
    const n = i + 1;
    return [
      { key: `question_${n}`, header: `Question ${n}`, required: false, example: n === 1 ? "What does this passage teach us about God's faithfulness?" : "" },
      { key: `question_${n}_answer_1`, header: `Question ${n} Answer 1`, required: false, example: n === 1 ? "He is always faithful" : "" },
      { key: `question_${n}_answer_2`, header: `Question ${n} Answer 2`, required: false, example: n === 1 ? "He is faithful sometimes" : "" },
      { key: `question_${n}_answer_3`, header: `Question ${n} Answer 3`, required: false, example: n === 1 ? "Faithfulness isn't mentioned" : "" },
      { key: `question_${n}_answer_4`, header: `Question ${n} Answer 4`, required: false, example: n === 1 ? "None of the above" : "" },
      { key: `question_${n}_right_answer`, header: `Question ${n} Right Answer (1-4)`, required: false, example: n === 1 ? "1" : "" },
    ];
  }).flat(),
];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function generateCampaignLessonCsvTemplate(): string {
  const header = CAMPAIGN_LESSON_CSV_COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const example = CAMPAIGN_LESSON_CSV_COLUMNS.map((c) => csvEscape(c.example)).join(",");
  return `${header}\r\n${example}\r\n`;
}

// RFC4180-ish parser: handles quoted fields, embedded commas/newlines inside quotes, and escaped
// "" for a literal quote. Returns an array of rows, each row an array of raw string cells.
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize line endings up front so \r\n / \r / \n all behave the same outside quoted fields.
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  // Final field/row, if the file doesn't end with a trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank trailing rows (a common artifact of a trailing newline or Excel's own export).
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export interface ParsedCampaignLessonRow {
  rowNumber: number; // 1-based, matches the row's position in the uploaded file (header = row 1)
  raw: Record<string, string>;
  input: CampaignLessonInput | null;
  // Kept separate from CampaignLessonInput -- that type is scalar lessons-table-fields-only, and
  // questions are saved through a different service call (replaceLessonQuestions) after the lesson
  // row exists. Always [] when input is null (a row with lesson-field errors doesn't get its
  // questions parsed at all -- see the errors.length short-circuit in validateCampaignLessonRow).
  questions: QuestionInput[];
  // Video/slides, same reasoning as questions above: saved via replaceLessonMediaByTypes after the
  // lesson row exists, not part of the lessons-table CampaignLessonInput. Only ever contains
  // entries for columns that were actually filled in -- an empty Video URL with a filled Slides URL
  // produces a single-item array, not a blank video entry.
  media: { mediaType: "video" | "slides"; url: string }[];
  errors: string[];
}

function parseBoolean(value: string): boolean {
  return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : NaN;
}

function columnHeader(key: string): string {
  return CAMPAIGN_LESSON_CSV_COLUMNS.find((c) => c.key === key)?.header ?? key;
}

export function validateCampaignLessonRow(
  raw: Record<string, string>
): { input: CampaignLessonInput | null; questions: QuestionInput[]; media: { mediaType: "video" | "slides"; url: string }[]; errors: string[] } {
  const errors: string[] = [];
  const get = (key: string) => (raw[key] ?? "").trim();

  for (const col of CAMPAIGN_LESSON_CSV_COLUMNS) {
    if (col.required && !get(col.key)) errors.push(`Missing required field "${col.header}".`);
  }

  // If a question is provided, all 4 answers and a right answer are required -- mirrors the manual
  // QuestionsEditor's validateQuestionDrafts rule so a partially-filled question never silently
  // imports as empty or with no correct answer flagged. The right answer resolves as a position
  // number 1-4 first (unambiguous, typo-proof for a non-technical admin filling in Excel), falling
  // back to a case-insensitive exact match against the 4 answer texts.
  const questions: QuestionInput[] = [];
  for (let n = 1; n <= MAX_CSV_QUESTIONS; n++) {
    const questionText = get(`question_${n}`);
    if (!questionText) continue;

    const answers = [1, 2, 3, 4].map((i) => get(`question_${n}_answer_${i}`));
    const rightAnswerRaw = get(`question_${n}_right_answer`);
    const missingAnswers = answers.some((a) => !a);
    if (missingAnswers) {
      errors.push(`Question ${n}: all 4 answer choices are required when a question is provided.`);
    }
    if (!rightAnswerRaw) {
      errors.push(`Question ${n}: a right answer is required when a question is provided.`);
    } else {
      const asPosition = parseIntOrNull(rightAnswerRaw);
      let correctIndex: number | null = null;
      if (asPosition !== null && !Number.isNaN(asPosition) && asPosition >= 1 && asPosition <= 4) {
        correctIndex = asPosition - 1;
      } else {
        correctIndex = answers.findIndex((a) => a.toLowerCase() === rightAnswerRaw.toLowerCase());
        if (correctIndex === -1) correctIndex = null;
      }
      if (correctIndex === null) {
        errors.push(`Question ${n}: right answer "${rightAnswerRaw}" must be 1-4 or match one of the 4 answer choices.`);
      } else if (!missingAnswers) {
        questions.push({
          question: questionText,
          choices: answers.map((answerText, i) => ({ answerText, isCorrect: i === correctIndex })),
        });
      }
    }
  }

  const monthNumber = parseIntOrNull(get("month_number"));
  if (get("month_number") && (monthNumber === null || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12)) {
    errors.push(`"${columnHeader("month_number")}" must be a whole number from 1 to 12.`);
  }
  const weekNumber = parseIntOrNull(get("week_number"));
  if (get("week_number") && (weekNumber === null || Number.isNaN(weekNumber) || weekNumber < 1 || weekNumber > 5)) {
    errors.push(`"${columnHeader("week_number")}" must be a whole number from 1 to 5.`);
  }
  const sortOrderRaw = get("sort_order");
  const sortOrder = parseIntOrNull(sortOrderRaw);
  if (sortOrderRaw && (sortOrder === null || Number.isNaN(sortOrder))) {
    errors.push(`"${columnHeader("sort_order")}" must be a whole number.`);
  }
  const displayStartDate = get("display_start_date");
  if (displayStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(displayStartDate)) {
    errors.push(`"${columnHeader("display_start_date")}" must be in YYYY-MM-DD format.`);
  }

  // All three are optional, but must be a real http(s) URL if a value is provided at all --
  // matches the manual admin form's own validation (isValidMediaUrl, shared with church lessons).
  const backgroundImageUrl = get("background_image_url");
  if (backgroundImageUrl && !isValidMediaUrl(backgroundImageUrl)) {
    errors.push(`"${columnHeader("background_image_url")}" must be a valid web address.`);
  }
  const videoUrl = get("video_url");
  if (videoUrl && !isValidMediaUrl(videoUrl)) {
    errors.push(`"${columnHeader("video_url")}" must be a valid web address.`);
  }
  const slidesUrl = get("slides_url");
  if (slidesUrl && !isValidMediaUrl(slidesUrl)) {
    errors.push(`"${columnHeader("slides_url")}" must be a valid web address.`);
  }

  if (errors.length > 0) return { input: null, questions: [], media: [], errors };

  const media: { mediaType: "video" | "slides"; url: string }[] = [];
  if (videoUrl) media.push({ mediaType: "video", url: videoUrl });
  if (slidesUrl) media.push({ mediaType: "slides", url: slidesUrl });

  const input: CampaignLessonInput = {
    campaignName: get("campaign_name"),
    campaignSprintSeason: get("sprint_season"),
    campaignMonth: get("month"),
    campaignMonthNumber: monthNumber,
    campaignWeekNumber: weekNumber,
    campaignMonthlyTheme: get("monthly_theme"),
    campaignMonthlyVerse: get("monthly_verse"),
    title: get("lesson_title"),
    shortDescription: get("lesson_summary"),
    aboutText: get("lesson_content"),
    campaignWeeklyVerse: get("weekly_verse"),
    campaignSpeakerName: get("speaker_name"),
    campaignSpeakerBio: get("speaker_bio"),
    campaignSpeakerImageUrl: get("speaker_image_url"),
    featuredImageUrl: get("thumbnail_url"),
    backgroundImageUrl,
    isFeatured: parseBoolean(get("is_featured")),
    isHighlighted: parseBoolean(get("is_highlighted")),
    sortOrder: sortOrder ?? 0,
    displayStartDate,
    linkedExperienceId: get("linked_experience_id") || null,
  };
  return { input, questions, media, errors: [] };
}

export interface ParsedCampaignLessonCsv {
  rows: ParsedCampaignLessonRow[];
  headerErrors: string[];
}

export function parseAndValidateCampaignLessonCsv(text: string): ParsedCampaignLessonCsv {
  const table = parseCsvText(text);
  if (table.length === 0) return { rows: [], headerErrors: ["The file is empty."] };

  const headerRow = table[0].map((h) => h.trim());
  const headerErrors: string[] = [];
  for (const col of CAMPAIGN_LESSON_CSV_COLUMNS) {
    if (!headerRow.includes(col.header)) headerErrors.push(`Missing expected column "${col.header}". Use the downloadable template.`);
  }
  if (headerErrors.length > 0) return { rows: [], headerErrors };

  const dataRows = table.slice(1);
  const rows: ParsedCampaignLessonRow[] = dataRows.map((cells, i) => {
    const raw: Record<string, string> = {};
    headerRow.forEach((header, colIndex) => {
      const col = CAMPAIGN_LESSON_CSV_COLUMNS.find((c) => c.header === header);
      if (col) raw[col.key] = cells[colIndex] ?? "";
    });
    const { input, questions, media, errors } = validateCampaignLessonRow(raw);
    return { rowNumber: i + 2, raw, input, questions, media, errors }; // +2: row 1 is the header, data starts at row 2
  });

  return { rows, headerErrors: [] };
}
