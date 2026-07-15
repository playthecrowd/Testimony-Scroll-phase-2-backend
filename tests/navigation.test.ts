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
