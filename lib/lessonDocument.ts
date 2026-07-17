// Shared validation/constants for lesson document uploads (the "Upload Notes (PDF, DOCX, TXT)"
// dropzone, real as of Phase 3 -- see docs/PHASE3_AUDIT.md). Mirrors lib/lessonThumbnail.ts's
// shape; pure (no Supabase import) so it can be used from both client components and the storage
// service.

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;
const DOCUMENT_ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

export function validateDocumentFile(file: File): string | null {
  const isAcceptedType = DOCUMENT_ACCEPTED_TYPES.includes(file.type as (typeof DOCUMENT_ACCEPTED_TYPES)[number]);
  // Some browsers report an empty/generic MIME type for .docx/.txt -- fall back to extension.
  const isAcceptedExtension = DOCUMENT_ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (!isAcceptedType && !isAcceptedExtension) {
    return "Please upload a PDF, DOCX, or TXT file.";
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return "File must be 20 MB or smaller.";
  }
  return null;
}
