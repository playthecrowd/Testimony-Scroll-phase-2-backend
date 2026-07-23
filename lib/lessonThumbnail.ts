// Shared validation/constants for lesson thumbnail uploads. Pure (no Supabase import) so it can
// be used from both client components and the storage service.

export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
export const THUMBNAIL_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const THUMBNAIL_RECOMMENDED_WIDTH = 1200;
export const THUMBNAIL_RECOMMENDED_HEIGHT = 675;
export const THUMBNAIL_RECOMMENDED_RATIO = THUMBNAIL_RECOMMENDED_WIDTH / THUMBNAIL_RECOMMENDED_HEIGHT;

export function validateThumbnailFile(file: File): string | null {
  if (!THUMBNAIL_ACCEPTED_TYPES.includes(file.type as (typeof THUMBNAIL_ACCEPTED_TYPES)[number])) {
    return "Please upload a JPEG, PNG, or WEBP image.";
  }
  if (file.size > THUMBNAIL_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

// Repair Batch 2, D21 (Trello FS5mWbvB): validateThumbnailFile above only ever checked the
// browser-reported file.type -- trivially spoofable (a File can be constructed with
// type: "image/png" and arbitrary non-image bytes), which is exactly what let a renamed text file
// through with no error and a broken-image result. This checks real file bytes against each
// format's actual magic-number signature.
//
// TRUSTED-BOUNDARY NOTE (read before relying on this for anything beyond UX): uploadLessonThumbnail
// (services/supabase/lessonThumbnails.ts) uploads directly from the browser to Supabase Storage --
// there is no server action or API route in this path that could re-run this check. The Storage
// bucket's own allowed_mime_types (0005_lesson_thumbnails.sql) is enforced server-side by Supabase
// and cannot be bypassed by client-side tampering, but it too only compares the declared
// Content-Type header against the allowlist -- it does not inspect actual bytes either, so a
// mislabeled file with a spoofed Content-Type would still pass it. This function closes the gap
// for a normal user who selects a genuinely corrupt or mislabeled file through this UI; it is NOT
// a security enforcement boundary against a determined attacker who bypasses the browser entirely
// and calls the Storage API directly with arbitrary bytes and a matching declared Content-Type.
// Closing that would require a real server-side validation boundary (e.g. a server action or Edge
// Function this upload routes through instead of going browser-to-storage directly), which is a
// new upload architecture out of this fix's scope.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP", expected at byte offset 8 of a RIFF container

export function bytesMatchSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((expected, i) => bytes[offset + i] === expected);
}

export function detectImageSignatureError(bytes: Uint8Array, declaredType: string): string | null {
  if (declaredType === "image/png") {
    return bytesMatchSignature(bytes, PNG_SIGNATURE) ? null : "This file doesn't look like a real PNG image. Please choose a different file.";
  }
  if (declaredType === "image/jpeg") {
    return bytesMatchSignature(bytes, JPEG_SIGNATURE) ? null : "This file doesn't look like a real JPEG image. Please choose a different file.";
  }
  if (declaredType === "image/webp") {
    const isValidWebp = bytesMatchSignature(bytes, RIFF_SIGNATURE) && bytesMatchSignature(bytes, WEBP_SIGNATURE, 8);
    return isValidWebp ? null : "This file doesn't look like a real WEBP image. Please choose a different file.";
  }
  // Not one of the three accepted types -- validateThumbnailFile already rejects this before byte
  // reading is ever attempted, so this branch is unreachable in normal use.
  return "Please upload a JPEG, PNG, or WEBP image.";
}

// Combined entry point: cheap checks (declared type, size) first, then a real byte-signature read
// only if those pass, since reading bytes is the more expensive step.
export async function validateThumbnailFileBytes(file: File): Promise<string | null> {
  const cheapError = validateThumbnailFile(file);
  if (cheapError) return cheapError;

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return detectImageSignatureError(header, file.type);
}

// Non-blocking check -- 16:9 is recommended, not required, so this returns a warning string
// rather than a validation failure.
export function checkThumbnailAspectRatio(width: number, height: number): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  const tolerance = 0.15;
  if (Math.abs(ratio - THUMBNAIL_RECOMMENDED_RATIO) > tolerance) {
    return "This image isn't close to 16:9 -- it may be cropped when displayed.";
  }
  return null;
}
