import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// QA phase (Trello "Mobile navigation portrait/landscape" defect, reported as "the site glides to
// the right"): every two-column `grid ...grid-cols-[1fr_XXXpx]` layout in the app needs an explicit
// min-w-0 (or equivalent) on its flexible column. Without it, CSS Grid's default `min-width: auto`
// on a grid item means the item can't shrink below the max-content width of its descendants (e.g.
// JourneyStagesBar's `min-w-max` stage row, or a native <select>'s intrinsic width) even when that
// descendant already has its own local overflow-x-auto -- the whole grid, and the page, grows past
// the viewport instead. Reproduced with Playwright at 375/414/768/1024px on `/` and `/lessons`
// before the fix (document.documentElement.scrollWidth > clientWidth); zero overflow after.
const REPO_ROOT = path.join(__dirname, "..");

const TWO_COLUMN_GRID_FILES = [
  "app/page.tsx",
  "app/lessons/page.tsx",
  "app/story/FullStoryView.tsx",
  "app/lessons/[lessonId]/LessonDetailClient.tsx",
  "app/backstories/[characterId]/page.tsx",
  "app/kingdom-scroll/KingdomScrollList.tsx",
  "app/experience-builder/ExperienceBuilderForm.tsx",
  "app/journey/[lessonId]/studied/StudiedClient.tsx",
  "app/journey/[lessonId]/experienced/page.tsx",
  "app/experience-builder/[lessonId]/edit/EditExperienceForm.tsx",
  "app/journey/[lessonId]/added-to-story/page.tsx",
];

test("every grid-cols-[1fr_...px] two-column layout has min-w-0 on its flexible column, so wide descendants can't push the page wider than the viewport", () => {
  for (const relPath of TWO_COLUMN_GRID_FILES) {
    const filePath = path.join(REPO_ROOT, ...relPath.split("/"));
    const source = readFileSync(filePath, "utf8");

    // Find each two-column grid declaration and its immediately-following element's className.
    const gridDeclarations = [...source.matchAll(/grid-cols-\[1fr[_ ]/g)];
    assert.ok(gridDeclarations.length > 0, `${relPath}: expected at least one grid-cols-[1fr_...] declaration`);

    for (const match of gridDeclarations) {
      const start = match.index!;
      // Look at the next ~400 chars after the grid div's own className closes, which should
      // contain the flexible column's opening tag with a min-w-0 class (directly, or via a
      // conditional/ternary render where at least one branch carries it).
      const windowSource = source.slice(start, start + 500);
      assert.match(
        windowSource,
        /min-w-0/,
        `${relPath}: two-column grid at offset ${start} has no min-w-0 within its flexible column -- ` +
          `wide descendant content (JourneyStagesBar, a native <select>, unbroken long text) can force ` +
          `the grid, and the page, wider than the viewport on mobile.`
      );
    }
  }
});

// Trello Stage 1 smoke test ("all critical routes load"): several server pages called
// createClient() (which itself throws SupabaseConfigError when env vars are missing) *before*
// entering their try/catch, so a missing/misconfigured Supabase env crashed the route with an
// uncaught 500 instead of the app's own graceful branded error state. Reproduced locally (no
// .env.local) and observed as the same class of crash on the deployed QA environment.
const CREATE_CLIENT_MUST_BE_GUARDED_FILES = [
  "app/events/page.tsx",
  "app/kingdom-scroll/page.tsx",
  "app/story/page.tsx",
  "app/episodes/page.tsx",
  "app/characters/page.tsx",
  "app/host-dashboard/page.tsx",
  "app/experience-builder/page.tsx",
  "app/admin/page.tsx",
];

test("createClient() in critical-route server pages is called inside a try/catch, not before it, so a missing Supabase env renders the branded error state instead of crashing the route", () => {
  // The exact shape of the bug: `const/let supabase = await createClient();` sitting at the
  // function body's top indentation level (2 spaces) is a *sibling* of the try block, not inside
  // it -- SupabaseConfigError thrown there is never caught. The fix either assigns supabase
  // inside the try (4+ space indent) or declares it with `let` at top level and assigns it inside
  // the try. Either way, an unguarded top-level `= await createClient()` must not exist.
  const unguardedTopLevelAssignment = /\n {2}(const|let) supabase = await createClient\(\);/;
  for (const relPath of CREATE_CLIENT_MUST_BE_GUARDED_FILES) {
    const filePath = path.join(REPO_ROOT, ...relPath.split("/"));
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(
      source,
      unguardedTopLevelAssignment,
      `${relPath}: createClient() is assigned outside any try block -- a missing/misconfigured ` +
        `Supabase env would throw SupabaseConfigError uncaught, crashing this route with a 500 ` +
        `instead of rendering its branded error state.`
    );
    assert.match(source, /try \{/, `${relPath}: expected at least one try block guarding createClient()`);
  }
});
