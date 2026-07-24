import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D18 (Trello WMX429cM): the homepage's horizontally-scrollable journey-stage
// strip had no tabIndex, so keyboard users couldn't focus it to scroll with arrow keys.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D18: the homepage's scrollable JourneyStagesBar wrapper is keyboard-focusable", () => {
  const source = read("app/page.tsx");
  const wrapperMatch = source.match(/<div className="mt-10 qk-card p-4 md:p-5 overflow-x-auto qk-scrollbar"[^>]*>\s*<JourneyStagesBar \/>/);
  assert.ok(wrapperMatch, "expected to find the journey-stage strip wrapper div");
  assert.match(wrapperMatch![0], /tabIndex=\{0\}/);
});
