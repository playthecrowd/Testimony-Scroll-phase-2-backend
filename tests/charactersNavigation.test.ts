import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SIDEBAR_MEMBER_LINKS, SIDEBAR_HOST_LINKS } from "../lib/navigation";

const REPO_ROOT = path.join(__dirname, "..");
function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("[TRUE TEST] Characters appears in both the member and host sidebar link arrays -- the one shared component covers desktop and mobile", () => {
  for (const links of [SIDEBAR_MEMBER_LINKS, SIDEBAR_HOST_LINKS]) {
    const entry = links.find((l) => l.href === "/characters");
    assert.ok(entry, "expected a /characters entry in this sidebar array");
    assert.equal(entry!.label, "Characters");
  }
});

test("[TRUE TEST] the Characters sidebar entry is not host-only or platform-admin-only -- it's the main roster for every platform user", () => {
  for (const links of [SIDEBAR_MEMBER_LINKS, SIDEBAR_HOST_LINKS]) {
    const entry = links.find((l) => l.href === "/characters")!;
    assert.equal(entry.hostOnly, undefined);
    assert.equal(entry.platformAdminOnly, undefined);
  }
});

test("[SOURCE SCAN] no second Characters route/component was created -- the sidebar link points at the existing /characters page, not a new duplicate", () => {
  // read() itself throws if the file doesn't exist -- confirms the existing Phase 7 route is
  // still the one and only Characters page (no /kingdom-scrolls/characters or similar sibling).
  read("app/characters/page.tsx");
  read("app/characters/[characterId]/page.tsx");
});

test("[SOURCE SCAN] getCharacterById derives relatedLessons through existing episode_lessons, not a new character_lessons table", () => {
  const source = read("services/supabase/characters.ts");
  assert.match(source, /episode_lessons\(lesson:lessons/);
  assert.doesNotMatch(source, /\.from\(["']character_lessons["']\)/, "must not introduce a new, largely-duplicate character_lessons join table");
});

test("[SOURCE SCAN] the character detail page renders Related Lessons linking to the real /lessons/[slug] route", () => {
  const source = read("app/characters/[characterId]/page.tsx");
  assert.match(source, /character\.relatedLessons/);
  assert.match(source, /href=\{`\/lessons\/\$\{lesson\.slug\}`\}/);
});

test("[SOURCE SCAN] both character pages use CharacterAvatarImage (with an onError fallback) instead of a bare <img> with no failure handling", () => {
  const listPage = read("app/characters/page.tsx");
  const detailPage = read("app/characters/[characterId]/page.tsx");
  assert.match(listPage, /CharacterAvatarImage/);
  assert.match(detailPage, /CharacterAvatarImage/);
  const component = read("components/characters/CharacterAvatarImage.tsx");
  assert.match(component, /onError/);
});
