import { BadgeDefinition, MemberBadgeAward } from "@/types";

// Phase 11.4: pure presentation logic extracted out of app/badges/page.tsx so it's independently
// testable without a React rendering harness (this repo has no Jest/Vitest/RTL, per its own
// testing convention -- node:test against pure functions only). A badge with
// isHiddenUntilEarned=true is excluded entirely until the member actually earns it -- never shown
// as a locked "mystery" badge. Ordering is always by displayOrder, deterministic regardless of
// insertion order or earned status.
export function selectVisibleBadges(all: BadgeDefinition[], awards: MemberBadgeAward[]): BadgeDefinition[] {
  const earnedIds = new Set(awards.filter((a) => !a.revokedAt).map((a) => a.badgeId));
  return all
    .filter((b) => !b.isHiddenUntilEarned || earnedIds.has(b.id))
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function isBadgeEarned(badge: BadgeDefinition, awards: MemberBadgeAward[]): boolean {
  return awards.some((a) => a.badgeId === badge.id && !a.revokedAt);
}
