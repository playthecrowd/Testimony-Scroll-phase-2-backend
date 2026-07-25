import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D14 (Trello vPXpf6a7): the icon-only show/hide-password toggle button had no
// accessible name, so screen readers announced it as an unlabeled button.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D14: password visibility toggle button has an aria-label reflecting its current state", () => {
  const source = read("components/auth/AuthScreen.tsx");
  const btnIdx = source.indexOf("setShowPw((v) => !v)");
  assert.notEqual(btnIdx, -1, "expected to find the password toggle button's onClick");
  const region = source.slice(btnIdx, btnIdx + 200);
  assert.match(region, /aria-label=\{showPw \? "Hide password" : "Show password"\}/);
});
