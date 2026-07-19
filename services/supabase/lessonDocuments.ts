import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeFileName } from "@/lib/utils";

const BUCKET = "lesson-documents";

// {churchId}/{lessonId}/{uniqueId}-{sanitized-file-name} -- same convention as lesson-thumbnails,
// so the storage.objects RLS policies can authorize by church_id (first path segment).
export function buildDocumentPath(churchId: string, lessonId: string, uniqueId: string, fileName: string): string {
  return `${churchId}/${lessonId}/${uniqueId}-${sanitizeFileName(fileName)}`;
}

export type UploadDocumentResult = { ok: true; publicUrl: string } | { ok: false; error: string };

export async function uploadLessonDocument(supabase: SupabaseClient, path: string, file: File): Promise<UploadDocumentResult> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: "Could not generate a public URL for the uploaded document." };
  }
  return { ok: true, publicUrl: data.publicUrl };
}
