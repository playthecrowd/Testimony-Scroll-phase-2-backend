import { Badge, BadgeStage, UserBadge } from "@/types";
import { badgeCatalog, getBadgeByStage } from "@/data/badges";
import { loadCollection, saveCollection, newId } from "@/lib/storage";

const KEY = "userBadges";

export function getAllBadges(): Badge[] {
  return badgeCatalog;
}

export function getUserBadges(userId: string): UserBadge[] {
  return loadCollection<UserBadge>(KEY, []).filter((b) => b.userId === userId);
}

export function hasBadge(userId: string, stage: BadgeStage, lessonId?: string): boolean {
  const badge = getBadgeByStage(stage);
  return getUserBadges(userId).some(
    (ub) => ub.badgeId === badge.id && (lessonId ? ub.lessonId === lessonId : true)
  );
}

export function awardBadge(userId: string, stage: BadgeStage, lessonId?: string): UserBadge {
  const badge = getBadgeByStage(stage);
  const all = loadCollection<UserBadge>(KEY, []);
  const existing = all.find((ub) => ub.userId === userId && ub.badgeId === badge.id && ub.lessonId === lessonId);
  if (existing) return existing;
  const record: UserBadge = {
    id: newId("ubadge"),
    userId,
    badgeId: badge.id,
    lessonId,
    earnedAt: new Date().toISOString(),
  };
  saveCollection(KEY, [...all, record]);
  return record;
}
