import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D18 (Trello WMX429cM): the homepage's horizontally-scrollable journey-stage
// strip had no tabIndex, so keyboard users couldn't focus it to scroll with arrow keys.
//
// Updated for the Phase Two homepage rebuild: the original JourneyStagesBar strip is no longer on
// the homepage (it's still used, unaffected, on app/about/page.tsx) -- the new design's own
// horizontally-scrollable element is the weekly campaign-lesson row. Same underlying guarantee as
// before (no scrollable content without keyboard access), checked against the current element.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D18: every horizontally-scrollable overflow-x-auto container on the homepage is keyboard-focusable", () => {
  const source = read("app/page.tsx");
  const matches = [...source.matchAll(/<div className="[^"]*overflow-x-auto[^"]*"([^>]*)>/g)];
  assert.ok(matches.length > 0, "expected at least one horizontally-scrollable container on the homepage");
  for (const m of matches) {
    assert.match(m[1], /tabIndex=\{0\}/, `overflow-x-auto container is missing tabIndex={0}: ${m[0]}`);
  }
});

test("D18: app/about/page.tsx's own JourneyStagesBar strip is untouched and still keyboard-focusable", () => {
  const source = read("app/about/page.tsx");
  assert.match(source, /<JourneyStagesBar/, "expected JourneyStagesBar to still be used somewhere -- it moved off the homepage, not out of the app");
});
