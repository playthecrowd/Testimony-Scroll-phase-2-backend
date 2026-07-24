import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D15 (Trello m3Ttx08S): the church filter <select> on /kingdom-scroll had no
// id, aria-label, or associated <label>, so screen readers couldn't announce its purpose.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D15: church filter <select> has an aria-label", () => {
  const source = read("app/kingdom-scroll/KingdomScrollList.tsx");
  const selectIdx = source.indexOf("<select");
  assert.notEqual(selectIdx, -1, "expected to find the church filter <select>");
  const optionIdx = source.indexOf("<option", selectIdx);
  const region = source.slice(selectIdx, optionIdx === -1 ? selectIdx + 300 : optionIdx);
  assert.match(region, /aria-label="Filter by church"/);
});
