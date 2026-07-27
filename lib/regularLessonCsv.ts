import { QuestionInput } from "@/services/supabase/questions";
import { isValidMediaUrl } from "@/lib/lessonForm";
import { parseCsvText } from "./campaignLessonCsv";

// Bulk CSV import for regular, church-authored lessons -- the host/church-manager counterpart to
// lib/campaignLessonCsv.ts (platform-admin-only). Deliberately mirrors that file's shape (same
// RFC4180-ish parser, reused directly rather than duplicated; same question-block generation; same
// validate-then-return-typed-input pattern) so the two importers behave identically from an
// admin's/host's point of view, per the "a campaign lesson is not a separate experience" rule --
// the two CSVs differ only in which columns exist, not in how validation/preview/import works.
//
// Deliberately does NOT include campaign_name/month/week/theme/verse (this is never a campaign
// lesson -- see services/supabase/regularLessons.ts, which always calls submit_lesson_draft, whose
// insert never sets is_campaign_lesson, so every row created this way is structurally
// is_campaign_lesson = false regardless of anything in the CSV). Also deliberately omits Topic/
// Ministry Category/Date, which the manual Experience Builder form requires but this bulk path does
// not -- only Lesson Title is required, matching the Campaign Lesson CSV's own minimal-required-set
// precedent.
export { parseCsvText };

const MAX_CSV_QUESTIONS = 5;

export interface RegularLessonCsvColumn {
  key: string;
  header: string;
  required: boolean;
  example: string;
}

export const REGULAR_LESSON_CSV_COLUMNS: RegularLessonCsvColumn[] = [
  { key: "lesson_title", header: "Lesson Title", required: true, example: "The Good Shepherd" },
  { key: "lesson_summary", header: "Lesson Summary", required: false, example: "Jesus cares for His people like a shepherd cares for his sheep." },
  { key: "lesson_content", header: "Lesson Content/Notes", required: false, example: "Full lesson notes go here." },
  { key: "weekly_verse", header: "Weekly Verse (if applicable)", required: false, example: "John 10:11" },
  { key: "thumbnail_url", header: "Thumbnail/Image URL", required: false, example: "https://example.com/lesson.jpg" },
  { key: "background_image_url", header: "Background Image URL", required: false, example: "" },
  { key: "video_url", header: "Video URL", required: false, example: "" },
  { key: "slides_url", header: "Slides URL", required: false, example: "" },
  { key: "speaker_name", header: "Speaker/Teacher Name", required: false, example: "Pastor Jordan" },
  { key: "published", header: "Published (true/false)", required: false, example: "false" },
  ...Array.from({ length: MAX_CSV_QUESTIONS }, (_, i): RegularLessonCsvColumn[] => {
    const n = i + 1;
    return [
      { key: `question_${n}`, header: `Question ${n}`, required: false, example: n === 1 ? "What does this passage teach us about God's care for us?" : "" },
      { key: `question_${n}_answer_1`, header: `Question ${n} Answer 1`, required: false, example: n === 1 ? "He watches over and protects us" : "" },
      { key: `question_${n}_answer_2`, header: `Question ${n} Answer 2`, required: false, example: n === 1 ? "He leaves us to fend for ourselves" : "" },
      { key: `question_${n}_answer_3`, header: `Question ${n} Answer 3`, required: false, example: n === 1 ? "Care isn't mentioned" : "" },
      { key: `question_${n}_answer_4`, header: `Question ${n} Answer 4`, required: false, example: n === 1 ? "None of the above" : "" },
      { key: `question_${n}_right_answer`, header: `Question ${n} Right Answer (1-4)`, required: false, example: n === 1 ? "1" : "" },
    ];
  }).flat(),
];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function generateRegularLessonCsvTemplate(): string {
  const header = REGULAR_LESSON_CSV_COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const example = REGULAR_LESSON_CSV_COLUMNS.map((c) => csvEscape(c.example)).join(",");
  return `${header}\r\n${example}\r\n`;
}

// Scalar lessons-table-fields-only, same convention as CampaignLessonInput -- church_id is
// deliberately NOT a field here. It's never read from the CSV; the import action derives it
// exclusively from the authenticated caller's own church_memberships row, so a CSV can never
// target another church no matter what it contains.
export interface RegularLessonInput {
  title: string;
  shortDescription: string;
  aboutText: string;
  primaryScripture: string;
  speakerName: string;
  featuredImageUrl: string;
  backgroundImageUrl: string;
  published: boolean;
}

export interface ParsedRegularLessonRow {
  rowNumber: number; // 1-based, matches the row's position in the uploaded file (header = row 1)
  raw: Record<string, string>;
  input: RegularLessonInput | null;
  questions: QuestionInput[];
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
  return REGULAR_LESSON_CSV_COLUMNS.find((c) => c.key === key)?.header ?? key;
}

export function validateRegularLessonRow(
  raw: Record<string, string>
): { input: RegularLessonInput | null; questions: QuestionInput[]; media: { mediaType: "video" | "slides"; url: string }[]; errors: string[] } {
  const errors: string[] = [];
  const get = (key: string) => (raw[key] ?? "").trim();

  for (const col of REGULAR_LESSON_CSV_COLUMNS) {
    if (col.required && !get(col.key)) errors.push(`Missing required field "${col.header}".`);
  }

  // Same rule as the Campaign Lesson CSV: if a question is provided, all 4 answers and a right
  // answer are required -- right answer resolves as a position number 1-4 first, falling back to a
  // case-insensitive exact match against the 4 answer texts.
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

  const backgroundImageUrl = get("background_image_url");
  if (backgroundImageUrl && !isValidMediaUrl(backgroundImageUrl)) {
    errors.push(`"${columnHeader("background_image_url")}" must be a valid web address.`);
  }
  const thumbnailUrl = get("thumbnail_url");
  if (thumbnailUrl && !isValidMediaUrl(thumbnailUrl)) {
    errors.push(`"${columnHeader("thumbnail_url")}" must be a valid web address.`);
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

  const input: RegularLessonInput = {
    title: get("lesson_title"),
    shortDescription: get("lesson_summary"),
    aboutText: get("lesson_content"),
    primaryScripture: get("weekly_verse"),
    speakerName: get("speaker_name"),
    featuredImageUrl: thumbnailUrl,
    backgroundImageUrl,
    published: parseBoolean(get("published")),
  };
  return { input, questions, media, errors: [] };
}

export interface ParsedRegularLessonCsv {
  rows: ParsedRegularLessonRow[];
  headerErrors: string[];
}

export function parseAndValidateRegularLessonCsv(text: string): ParsedRegularLessonCsv {
  const table = parseCsvText(text);
  if (table.length === 0) return { rows: [], headerErrors: ["The file is empty."] };

  const headerRow = table[0].map((h) => h.trim());
  const headerErrors: string[] = [];
  for (const col of REGULAR_LESSON_CSV_COLUMNS) {
    if (!headerRow.includes(col.header)) headerErrors.push(`Missing expected column "${col.header}". Use the downloadable template.`);
  }
  if (headerErrors.length > 0) return { rows: [], headerErrors };

  const dataRows = table.slice(1);
  const rows: ParsedRegularLessonRow[] = dataRows.map((cells, i) => {
    const raw: Record<string, string> = {};
    headerRow.forEach((header, colIndex) => {
      const col = REGULAR_LESSON_CSV_COLUMNS.find((c) => c.header === header);
      if (col) raw[col.key] = cells[colIndex] ?? "";
    });
    const { input, questions, media, errors } = validateRegularLessonRow(raw);
    return { rowNumber: i + 2, raw, input, questions, media, errors }; // +2: row 1 is the header, data starts at row 2
  });

  return { rows, headerErrors: [] };
}
