import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D13 (Trello 2YFexlyD): AuthScreen's Full Name/Email/Password labels had no
// id/htmlFor pairing, so screen readers couldn't announce which field a label described.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D13: auth form fields have a matching id/htmlFor pair", () => {
  const source = read("components/auth/AuthScreen.tsx");

  for (const id of ["auth-full-name", "auth-email", "auth-password"]) {
    const labelRe = new RegExp(`htmlFor="${id}"`);
    const inputRe = new RegExp(`id="${id}"`);
    assert.match(source, labelRe, `expected a label with htmlFor="${id}"`);
    assert.match(source, inputRe, `expected a field with id="${id}"`);
  }
});
