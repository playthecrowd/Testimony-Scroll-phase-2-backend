import { PublishedLesson } from "@/types";

// Fixed, stable vocabulary -- never a lesson_media row id, never derived from a displayed title
// (see supabase/migrations/0008_lesson_journeys.sql for why: this is what keeps a member's
// completion stable when a Host edits lesson content later).
export type ChecklistItemKey =
  | "overview"
  | "primary_scripture"
  | "supporting_scriptures"
  | "notes"
  | "video"
  | "audio"
  | "slides"
  | "document"
  | "questions";

export interface ChecklistItemDef {
  key: ChecklistItemKey;
  label: string;
}

const ALL_ITEM_KEYS: ChecklistItemKey[] = [
  "overview",
  "primary_scripture",
  "supporting_scriptures",
  "notes",
  "video",
  "audio",
  "slides",
  "document",
  "questions",
];

// Minimal shape this needs from a lesson -- accepts the real PublishedLesson, but kept narrow so
// tests can pass a plain fixture without constructing a full Supabase row.
export interface ChecklistLessonInput {
  aboutText: PublishedLesson["aboutText"];
  primaryScripture: PublishedLesson["primaryScripture"];
  supportingScriptures: PublishedLesson["supportingScriptures"];
  media: { mediaType: string }[];
}

// Determines which checklist items apply to a given lesson from its *actual available content*
// -- a lesson without video never requires "Watch the video", one with notes always includes the
// notes item, and any combination of lesson_media rows is handled without any code change (no
// per-lesson or per-media-row branching). "questions" is always included: the reflection
// questions surface always renders something (Host-authored when that exists, a generic fallback
// bank otherwise -- see PHASE 9 audit findings), so there's always a "questions" item to complete.
export function getApplicableChecklistItems(lesson: ChecklistLessonInput): ChecklistItemDef[] {
  const mediaTypes = new Set(lesson.media.map((m) => m.mediaType));
  const items: ChecklistItemDef[] = [];

  if (lesson.aboutText?.trim()) items.push({ key: "overview", label: "Read the lesson overview" });
  if (lesson.primaryScripture?.trim()) items.push({ key: "primary_scripture", label: "Read the primary scripture" });
  if (lesson.supportingScriptures.length > 0) items.push({ key: "supporting_scriptures", label: "Review supporting scriptures" });
  if (mediaTypes.has("notes")) items.push({ key: "notes", label: "Read the notes" });
  if (mediaTypes.has("video")) items.push({ key: "video", label: "Watch the video" });
  if (mediaTypes.has("audio")) items.push({ key: "audio", label: "Listen to the audio" });
  if (mediaTypes.has("slides")) items.push({ key: "slides", label: "Review the slides" });
  if (mediaTypes.has("document")) items.push({ key: "document", label: "Review attached documents" });
  items.push({ key: "questions", label: "Complete reflection questions" });

  return items;
}

export function isKnownChecklistItemKey(key: string): key is ChecklistItemKey {
  return (ALL_ITEM_KEYS as string[]).includes(key);
}
