import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 4, D20 (Trello gkNWwB0e): homepage's featured "Church Archives" card linked to a
// nonexistent lesson because it was sourced from the legacy mock/localStorage catalog
// (services/lessonService.ts), never migrated into Supabase, while /lessons/[slug] resolves only
// against the real Supabase catalog.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D20: app/page.tsx no longer imports the legacy mock lesson catalog for its featured card", () => {
  const source = read("app/page.tsx");
  assert.doesNotMatch(
    source,
    /from "@\/services\/lessonService"/,
    "the homepage must not read from the mock/localStorage lesson catalog -- that's the exact data-source mismatch that produced the dead link"
  );
});

test("D20: the featured lesson is sourced from the real Supabase getPublishedLessons query, the same one real lesson listings already use", () => {
  const source = read("app/page.tsx");
  assert.match(source, /from "@\/services\/supabase\/lessons"/);
  assert.match(source, /getPublishedLessons\(/);
});

test("D20: fetching the featured lesson is guarded against a Supabase failure (config error, network) so the homepage still renders for an anonymous visitor", () => {
  const source = read("app/page.tsx");
  const fnMatch = source.match(/async function getFeaturedLesson\(\)[\s\S]*?\n}/);
  assert.ok(fnMatch, "expected a getFeaturedLesson function");
  assert.match(fnMatch![0], /try \{/);
  assert.match(fnMatch![0], /catch \{/);
  assert.match(fnMatch![0], /return null;/);
});

test("D20: the featured card uses LessonThumbnail (graceful fallback for a missing/broken image), not a raw Image that would throw on a null src", () => {
  const source = read("app/page.tsx");
  assert.match(source, /<LessonThumbnail/);
});
