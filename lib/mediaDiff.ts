import { LessonMediaType } from "@/types";

// Row shape the edit form works with -- id is null for a not-yet-saved item the Host just added.
export interface EditableMediaItem {
  id: string | null;
  mediaType: LessonMediaType;
  url: string;
  content: string;
  title: string;
  sortOrder: number;
}

export interface ExistingMediaRow {
  id: string;
}

export interface MediaDiff {
  toInsert: EditableMediaItem[];
  toUpdate: (EditableMediaItem & { id: string })[];
  toDeleteIds: string[];
}

// Pure diff: never invents a delete for a row the Host didn't remove, and never re-creates a row
// that already has an id (so retried/duplicate saves can't produce duplicate lesson_media rows).
export function computeMediaDiff(existing: ExistingMediaRow[], submitted: EditableMediaItem[]): MediaDiff {
  const submittedIds = new Set(submitted.filter((m) => m.id).map((m) => m.id as string));
  const toDeleteIds = existing.filter((row) => !submittedIds.has(row.id)).map((row) => row.id);

  const toInsert = submitted.filter((m) => !m.id);
  const toUpdate = submitted.filter((m): m is EditableMediaItem & { id: string } => !!m.id);

  return { toInsert, toUpdate, toDeleteIds };
}
