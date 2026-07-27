import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 4, D20 (Trello gkNWwB0e): homepage's featured "Church Archives" card linked to a
// nonexistent lesson because it was sourced from the legacy mock/localStorage catalog
// (services/lessonService.ts), never migrated into Supabase, while /lessons/[slug] resolves only
// against the real Supabase catalog.
//
// Updated for the Phase Two homepage rebuild: the original "Church Archives" card and its
// `getFeaturedLesson()` helper no longer exist -- they were replaced by the weekly campaign-lesson
// row (real Supabase data via getCampaignLessons/getCurrentWeekCampaignLesson, same
// services/supabase/lessons.ts file). The four checks below were rewritten against the new shape,
// but assert the exact same underlying guarantees as before: never read from the mock catalog,
// always source from real Supabase queries, always degrade gracefully instead of crashing, and
// always render lesson images through the same safe/graceful component every other real lesson
// card uses.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D20: app/page.tsx no longer imports the legacy mock lesson catalog", () => {
  const source = read("app/page.tsx");
  assert.doesNotMatch(
    source,
    /from "@\/services\/lessonService"/,
    "the homepage must not read from the mock/localStorage lesson catalog -- that's the exact data-source mismatch that produced the original dead link"
  );
});

test("D20: the homepage's lesson content is sourced from real Supabase queries in services/supabase/lessons, the same file every real lesson listing already uses", () => {
  const source = read("app/page.tsx");
  assert.match(source, /from "@\/services\/supabase\/lessons"/);
  assert.match(source, /getCampaignLessons\(/, "expected the homepage to call the real, Supabase-backed getCampaignLessons");
  assert.match(source, /getCurrentWeekCampaignLesson\(/, "expected the homepage to call the real, Supabase-backed getCurrentWeekCampaignLesson");
});

test("D20: fetching homepage data is guarded against a Supabase failure (config error, network) so the page still renders for an anonymous visitor, never crashes", () => {
  const source = read("app/page.tsx");
  const fnMatch = source.match(/export default async function HomePage\(\)[\s\S]*?\n}/);
  assert.ok(fnMatch, "expected a HomePage function");
  assert.match(fnMatch![0], /try \{/);
  assert.match(fnMatch![0], /\} catch \(/);
});

test("D20: campaign lesson cards render their thumbnail through LessonThumbnail (graceful fallback for a missing/broken image), not a raw Image that would throw on a null src", () => {
  const source = read("components/lessons/CampaignLessonCard.tsx");
  assert.match(source, /<LessonThumbnail/);
  assert.match(source, /src=\{lesson\.featuredImageUrl\}/);
});

test("D20: the homepage links every campaign lesson card by its real slug, resolvable at /lessons/[slug] against the real Supabase catalog", () => {
  const source = read("components/lessons/CampaignLessonCard.tsx");
  assert.match(source, /href=\{`\/lessons\/\$\{lesson\.slug\}`\}/);
});
