import { test } from "node:test";
import assert from "node:assert/strict";
import { selectVisibleBadges, isBadgeEarned } from "../lib/badgePresentation";
import { BadgeDefinition, MemberBadgeAward } from "../types";

// Phase 11.4: pure-function unit tests for the badge cabinet's presentation logic, matching this
// repo's existing plain-function unit-test style.

function badge(overrides: Partial<BadgeDefinition>): BadgeDefinition {
  return {
    id: overrides.id ?? "badge-1",
    slug: overrides.slug ?? "test-badge",
    name: overrides.name ?? "Test Badge",
    description: null,
    imageUrl: null,
    category: overrides.category ?? "achievement",
    requirementType: "single_event",
    relatedEventType: "lesson_studied",
    threshold: null,
    isActive: true,
    isHiddenUntilEarned: overrides.isHiddenUntilEarned ?? false,
    displayOrder: overrides.displayOrder ?? 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function award(overrides: Partial<MemberBadgeAward>): MemberBadgeAward {
  return {
    id: overrides.id ?? "award-1",
    memberId: "member-1",
    badgeId: overrides.badgeId ?? "badge-1",
    awardSource: "lesson_studied",
    relatedLessonId: null,
    relatedExperienceId: null,
    relatedTestimonyId: null,
    awardedAt: "2026-02-01T00:00:00Z",
    awardedBy: null,
    revokedAt: overrides.revokedAt ?? null,
    revocationReason: null,
    ...overrides,
  };
}

test("selectVisibleBadges: a hidden-until-earned badge is excluded when not yet earned", () => {
  const badges = [badge({ id: "b1", isHiddenUntilEarned: true })];
  const visible = selectVisibleBadges(badges, []);
  assert.deepEqual(visible, []);
});

test("selectVisibleBadges: a hidden-until-earned badge is included once actually earned", () => {
  const badges = [badge({ id: "b1", isHiddenUntilEarned: true })];
  const awards = [award({ badgeId: "b1" })];
  const visible = selectVisibleBadges(badges, awards);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, "b1");
});

test("selectVisibleBadges: a revoked award does not count as earned for hidden-badge visibility", () => {
  const badges = [badge({ id: "b1", isHiddenUntilEarned: true })];
  const awards = [award({ badgeId: "b1", revokedAt: "2026-03-01T00:00:00Z" })];
  const visible = selectVisibleBadges(badges, awards);
  assert.deepEqual(visible, []);
});

test("selectVisibleBadges: orders deterministically by displayOrder regardless of input order", () => {
  const badges = [
    badge({ id: "b3", displayOrder: 3 }),
    badge({ id: "b1", displayOrder: 1 }),
    badge({ id: "b2", displayOrder: 2 }),
  ];
  const visible = selectVisibleBadges(badges, []);
  assert.deepEqual(visible.map((b) => b.id), ["b1", "b2", "b3"]);
});

test("selectVisibleBadges: a non-hidden badge is always visible, earned or not", () => {
  const badges = [badge({ id: "b1", isHiddenUntilEarned: false })];
  assert.equal(selectVisibleBadges(badges, []).length, 1);
});

test("selectVisibleBadges: trophy-category badges are included alongside achievements", () => {
  const badges = [badge({ id: "b1", category: "achievement" }), badge({ id: "b2", category: "trophy", displayOrder: 1 })];
  const visible = selectVisibleBadges(badges, []);
  assert.equal(visible.length, 2);
  assert.ok(visible.some((b) => b.category === "trophy"));
});

test("isBadgeEarned: true only for a non-revoked award matching this badge", () => {
  const b = badge({ id: "b1" });
  assert.equal(isBadgeEarned(b, [award({ badgeId: "b1" })]), true);
  assert.equal(isBadgeEarned(b, [award({ badgeId: "b1", revokedAt: "2026-03-01T00:00:00Z" })]), false);
  assert.equal(isBadgeEarned(b, [award({ badgeId: "other-badge" })]), false);
  assert.equal(isBadgeEarned(b, []), false);
});
