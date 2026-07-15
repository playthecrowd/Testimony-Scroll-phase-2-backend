// Shared between the create (Experience Builder) and edit lesson forms/actions, so both enforce
// identical validation and trusted-URL rules rather than drifting apart.

// Only http/https are ever accepted -- this alone rejects javascript:, data:, file:, and any
// other unsafe scheme, since none of them parse to protocol "http:" / "https:".
export function isValidMediaUrl(value: string): boolean {
  if (!value.trim()) return true; // empty is fine, media fields are individually optional
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface RequiredLessonFields {
  title: string;
  topic: string;
  shortDescription: string;
  speakerName: string;
  date: string;
  ministryCategory: string;
  primaryScripture: string;
}

// Returns a user-facing error message, or null if every required field is present. Mirrors the
// required-field set submit_lesson_draft/updateLessonExperience both enforce server-side too.
export function validateRequiredLessonFields(input: RequiredLessonFields): string | null {
  if (!input.title?.trim()) return "Lesson title is required.";
  if (!input.topic?.trim()) return "Main topic is required.";
  if (!input.shortDescription?.trim()) return "Short description is required.";
  if (!input.speakerName?.trim()) return "Speaker/teacher is required.";
  if (!input.date?.trim()) return "Lesson date is required.";
  if (!input.ministryCategory?.trim()) return "Ministry category is required.";
  if (!input.primaryScripture?.trim()) return "Primary scripture is required.";
  return null;
}

export interface MediaSourceCheckInput {
  notesUrl: string;
  videoUrl: string;
  audioUrl: string;
  slidesUrl: string;
  documentUrl: string;
  transcript: string;
}

export function hasAtLeastOneContentSource(input: MediaSourceCheckInput): boolean {
  return !!(input.notesUrl || input.videoUrl || input.audioUrl || input.slidesUrl || input.documentUrl || input.transcript);
}
