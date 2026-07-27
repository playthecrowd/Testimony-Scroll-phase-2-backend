import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleTopBarLinks, SIDEBAR_MEMBER_LINKS, SIDEBAR_HOST_LINKS } from "../lib/navigation";

// Regression for PHASE 13: Build Experience must never be visible to a Kingdom Member or an
// anonymous visitor, only to a Host, and both nav surfaces must agree (single source of truth).

test("TopBar hides Build Experience for anonymous visitors", () => {
  const labels = visibleTopBarLinks(false).map((l) => l.label);
  assert.ok(!labels.includes("Experience Builder"));
});

test("TopBar shows Build Experience only for a Host", () => {
  const labels = visibleTopBarLinks(true).map((l) => l.label);
  assert.ok(labels.includes("Experience Builder"));
});

test("Sidebar's Kingdom Member link set never includes Build Experience", () => {
  const labels = SIDEBAR_MEMBER_LINKS.map((l) => l.label);
  assert.ok(!labels.includes("Build Experience"));
  assert.ok(!SIDEBAR_MEMBER_LINKS.some((l) => l.href === "/experience-builder"));
});

test("Sidebar's Host link set includes Build Experience", () => {
  const labels = SIDEBAR_HOST_LINKS.map((l) => l.label);
  assert.ok(labels.includes("Build Experience"));
});

// Regression: Campaign Lessons admin link must be reachable from both sidebar link sets (a
// platform admin's accountType can be "member" or "host") but flagged platformAdminOnly so a
// non-admin viewer of either set never sees it -- Sidebar.tsx is responsible for filtering it out.
test("Campaign Lessons admin link is present in both sidebar link sets, flagged platformAdminOnly", () => {
  for (const links of [SIDEBAR_MEMBER_LINKS, SIDEBAR_HOST_LINKS]) {
    const link = links.find((l) => l.href === "/admin/campaign-lessons");
    assert.ok(link, "Campaign Lessons link missing from sidebar link set");
    assert.equal(link?.label, "Campaign Lessons");
    assert.equal(link?.platformAdminOnly, true);
  }
});
