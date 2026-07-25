import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 7, D4 (Trello Fok6VgPM): the church invite share text on
// /host-dashboard/members rendered as "...Church Bas a Kingdom Member..." -- the space between
// {church.name} and the literal "as" was dropped. Reproduced live as both Church A Host and
// Church B Host on production.quest4thekingdom.com before this fix; the JSX source *looked*
// correct (a literal space before "as"), but React's rendered text nodes showed the tail
// segment as "as a Kingdom Member..." with no leading space -- a compiler-level JSX
// adjacent-text-and-expression whitespace issue (this app builds with Turbopack/SWC), not a
// missing character in source. Fixed by collapsing the whole sentence into a single template
// literal expression, so there's only one text child and no inter-child boundary for a compiler
// to mishandle.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D4: the church invite sentence is a single template-literal expression with the space intact", () => {
  const source = read("components/host-dashboard/ChurchMembersManager.tsx");
  assert.match(
    source,
    /\{`Anyone with this link can join \$\{church\.name\} as a Kingdom Member once they're signed in\.`\}/
  );
});

test("D4: the sentence is not split into separate {church.name} and literal-text JSX children (the pattern that dropped the space)", () => {
  const source = read("components/host-dashboard/ChurchMembersManager.tsx");
  // Excludes the fixed form, ${church.name}, which legitimately contains the substring
  // "{church.name}" as part of a template-literal interpolation, not a standalone JSX child.
  assert.doesNotMatch(source, /(?<!\$)\{church\.name\}\s*as a Kingdom Member/);
});

test("D4: [TRUE TEST] the fixed template literal produces the exact expected string with correct spacing for any church name", () => {
  const churchName = "Quest for the Kingdom QA -- Church B";
  const text = `Anyone with this link can join ${churchName} as a Kingdom Member once they're signed in.`;
  assert.equal(text, "Anyone with this link can join Quest for the Kingdom QA -- Church B as a Kingdom Member once they're signed in.");
  assert.doesNotMatch(text, /Bas a Kingdom Member/);
});
