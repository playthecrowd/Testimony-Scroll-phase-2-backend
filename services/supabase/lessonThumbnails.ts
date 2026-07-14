import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeFileName } from "@/lib/lessonThumbnail";

const BUCKET = "lesson-thumbnails";

// {churchId}/{lessonId}/{uniqueId}-{sanitized-file-name} -- predictable, collision-resistant, and
// scoped so the storage.objects RLS policies can authorize by church_id (first path segment).
export function buildThumbnailPath(churchId: string, lessonId: string, uniqueId: string, fileName: string): string {
  return `${churchId}/${lessonId}/${uniqueId}-${sanitizeFileName(fileName)}`;
}

export type UploadThumbnailResult = { publicUrl: string; error?: undefined } | { error: string; publicUrl?: undefined };

// upsert: true means retrying the same (lessonId, uniqueId) pair overwrites in place instead of
// creating an orphaned duplicate object if a submit/save is retried.
export async function uploadLessonThumbnail(
  supabase: SupabaseClient,
  path: string,
  file: File
): Promise<UploadThumbnailResult> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

// Public URLs look like ".../storage/v1/object/public/lesson-thumbnails/<path>" -- pull the path
// back out so a stored featured_image_url can be deleted later without keeping a parallel column.
export function extractThumbnailPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  } catch {
    return null;
  }
}

// Best-effort: only ever called after the replacement/removal has already been confirmed
// successful, so a failure here just leaves a harmless orphaned object rather than losing data.
export async function deleteLessonThumbnailByUrl(supabase: SupabaseClient, publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  const path = extractThumbnailPath(publicUrl);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
