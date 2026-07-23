export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Repair Batch 2, D23: shared UUID-shape check used by submitTestimonyAction's client-side defense
// in depth (a "use server" file may only export async functions, so this pure regex check has to
// live here rather than inline in the action itself) -- the real enforcement is
// submit_testimony_idempotent's own format check (0036_testimony_idempotency.sql).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Reads the current wall-clock time internally so callers never call Date.now() directly in a
// component's render body (react-hooks/purity) -- used for the Host Dashboard's 7-day "New"
// lesson badge.
export function isWithin(dateStr: string, windowMs: number): boolean {
  return Date.now() - new Date(dateStr).getTime() < windowMs;
}

// Strips anything that isn't safe in a storage path, keeps the extension, and caps length so a
// pathological filename can't blow up a {churchId}/{lessonId}/{name} object key. Shared by both
// lesson thumbnail and lesson document uploads (lib/lessonThumbnail.ts, lib/lessonDocument.ts).
export function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const ext = dotIndex > -1 ? name.slice(dotIndex).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const base = (dotIndex > -1 ? name.slice(0, dotIndex) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "file"}${ext}`;
}
