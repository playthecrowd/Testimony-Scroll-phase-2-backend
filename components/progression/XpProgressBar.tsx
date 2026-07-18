import { ProgressionLevelThreshold } from "@/types";
import { calculateLevelFromXp } from "@/lib/progressionLevels";

// Phase 11.4: accurate, backend-driven XP/level presentation (spec: "must use authoritative level
// thresholds from the backend or service layer... do not calculate levels from hard-coded frontend
// thresholds"). thresholds always comes from services/supabase/progression.ts's
// getAllLevelThresholds -- never a literal array in this component.
export function XpProgressBar({ xpTotal, thresholds }: { xpTotal: number; thresholds: ProgressionLevelThreshold[] }) {
  if (thresholds.length === 0) {
    // Missing/incomplete level configuration -- render the raw XP total plainly rather than a
    // progress bar with no real denominator to measure against.
    return (
      <div>
        <p className="text-sm font-medium text-foreground">{xpTotal.toLocaleString()} XP</p>
        <p className="text-[11px] text-muted mt-1">Level configuration is not available right now.</p>
      </div>
    );
  }

  const sorted = [...thresholds].sort((a, b) => a.level - b.level);
  const currentLevel = calculateLevelFromXp(xpTotal, sorted);
  const currentThreshold = sorted.find((t) => t.level === currentLevel) ?? sorted[0];
  const nextThreshold = sorted.find((t) => t.level === currentLevel + 1);

  if (!nextThreshold) {
    // Maximum configured level reached.
    return (
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-semibold text-foreground">Level {currentLevel} (Max)</span>
          <span className="text-xs text-muted">{xpTotal.toLocaleString()} XP</span>
        </div>
        <div
          role="progressbar"
          aria-label={`Level ${currentLevel}, maximum level reached`}
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 rounded-full bg-surface-2 overflow-hidden"
        >
          <div className="h-full bg-accent-gold" style={{ width: "100%" }} />
        </div>
        <p className="text-[11px] text-muted mt-1.5">You&apos;ve reached the highest level currently available.</p>
      </div>
    );
  }

  const span = nextThreshold.minXp - currentThreshold.minXp;
  const progressedWithinLevel = xpTotal - currentThreshold.minXp;
  const percent = span > 0 ? Math.max(0, Math.min(100, Math.round((progressedWithinLevel / span) * 100))) : 100;
  const xpRemaining = Math.max(0, nextThreshold.minXp - xpTotal);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-semibold text-foreground">Level {currentLevel}</span>
        <span className="text-xs text-muted">{xpTotal.toLocaleString()} XP</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Level ${currentLevel} progress toward level ${nextThreshold.level}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 rounded-full bg-surface-2 overflow-hidden"
      >
        <div className="h-full bg-accent-blue" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[11px] text-muted mt-1.5">
        {xpRemaining.toLocaleString()} XP to Level {nextThreshold.level}
      </p>
    </div>
  );
}
