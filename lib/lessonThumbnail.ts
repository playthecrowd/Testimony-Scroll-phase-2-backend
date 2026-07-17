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
