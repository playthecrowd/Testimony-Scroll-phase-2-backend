import { ProgressionLevelThreshold } from "@/types";

// Phase 11.3 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS13, docs/PHASE11_3_AUDIT.md): pure
// mirror of the level-lookup logic private.award_progression_event (migration 0033) uses --
// read-only preview/display helper for a future UI to show "level N, M XP to next level" without
// needing its own round trip if the threshold table is already loaded. The database function
// remains the sole authority on a member's actual current_level; this must never be used to write
// or assert a level.
export function calculateLevelFromXp(xpTotal: number, thresholds: Pick<ProgressionLevelThreshold, "level" | "minXp">[]): number {
  const eligible = thresholds.filter((t) => t.minXp <= xpTotal);
  if (eligible.length === 0) return 1;
  return eligible.reduce((highest, t) => (t.level > highest.level ? t : highest), eligible[0]).level;
}

// XP still needed to reach the next level, or null if already at (or above) the highest defined
// level.
export function xpToNextLevel(xpTotal: number, thresholds: Pick<ProgressionLevelThreshold, "level" | "minXp">[]): number | null {
  const currentLevel = calculateLevelFromXp(xpTotal, thresholds);
  const next = thresholds.find((t) => t.level === currentLevel + 1);
  return next ? next.minXp - xpTotal : null;
}
