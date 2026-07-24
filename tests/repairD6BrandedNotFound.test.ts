import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Repair Batch 4, D6 (Trello crZzn7LH): no app/not-found.tsx existed, so any invalid dynamic route
// fell back to Next's unstyled default 404 page, with no app branding and no way back into the app.
const REPO_ROOT = path.join(__dirname, "..");

test("D6: app/not-found.tsx exists and uses the app's own shell (Logo, branded button, real link home), not Next's default page", () => {
  const filePath = path.join(REPO_ROOT, "app", "not-found.tsx");
  assert.ok(existsSync(filePath), "expected app/not-found.tsx to exist");
  const source = readFileSync(filePath, "utf8");
  assert.match(source, /<Logo/);
  assert.match(source, /<LinkButton href="\/"/, "expected a real link back to the homepage");
});
