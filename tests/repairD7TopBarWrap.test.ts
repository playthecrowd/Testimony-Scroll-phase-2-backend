import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 5, D7 (Trello iCj9X9zs): at the lg breakpoint's narrower end (~1024-1300px), the
// Host-only extra nav link pushed total row width past what fit, and individual link text wrapped
// mid-word instead of the row handling it -- ugly, uneven top bar.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D7: top bar nav links have whitespace-nowrap so link text can't wrap mid-word", () => {
  const source = read("components/layout/TopBar.tsx");
  const navMatch = source.match(/<nav className="[\s\S]*?<\/nav>/);
  assert.ok(navMatch, "expected to find the nav element");
  assert.match(navMatch![0], /whitespace-nowrap/);
});

test("D7: the account name/role text in AccountMenu also has whitespace-nowrap, matching the QA report's second wrapping symptom", () => {
  const source = read("components/layout/AccountMenu.tsx");
  const nameSpanIdx = source.indexOf("text-sm font-semibold text-foreground");
  assert.notEqual(nameSpanIdx, -1, "expected to find the account-name span's className");
  const nameRegion = source.slice(nameSpanIdx, nameSpanIdx + 60);
  assert.match(nameRegion, /whitespace-nowrap/);

  const roleRegion = source.slice(source.indexOf('"Kingdom Member"') - 150, source.indexOf('"Kingdom Member"') + 20);
  assert.match(roleRegion, /whitespace-nowrap/);
});
