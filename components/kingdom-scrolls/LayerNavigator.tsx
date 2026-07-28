"use client";

import { Castle, Church, Home, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorldLevel } from "@/lib/kingdomScrollsWorld";

const LEVELS: { key: WorldLevel; label: string; icon: React.ElementType }[] = [
  { key: "upper", label: "Upper Kingdom", icon: Castle },
  { key: "land", label: "Church Land", icon: Church },
  { key: "plot", label: "My Plot", icon: Home },
];

// Desktop: ornate vertical control fixed to the map edge. Mobile: same component, just laid out
// horizontally by the parent's responsive className -- see the `orientation` prop.
export function LayerNavigator({
  current,
  onSelect,
  disabledLevels,
  orientation = "vertical",
}: {
  current: WorldLevel;
  onSelect: (level: WorldLevel) => void;
  disabledLevels?: Partial<Record<WorldLevel, string>>; // level -> reason (e.g. "Join a church to unlock")
  orientation?: "vertical" | "horizontal";
}) {
  const currentIndex = LEVELS.findIndex((l) => l.key === current);

  function step(direction: 1 | -1) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= LEVELS.length) return;
    const next = LEVELS[nextIndex];
    if (disabledLevels?.[next.key]) return;
    onSelect(next.key);
  }

  return (
    <div
      className={cn(
        "ks-panel p-1.5 flex gap-1.5 items-center",
        orientation === "vertical" ? "flex-col" : "flex-row"
      )}
      role="group"
      aria-label="World level"
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={currentIndex <= 0}
        aria-label="Move up one level"
        className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 focus-ring"
        style={{ color: "var(--ks-text-dim)" }}
      >
        <ArrowUp size={15} />
      </button>

      {LEVELS.map((level) => {
        const Icon = level.icon;
        const isActive = level.key === current;
        const disabledReason = disabledLevels?.[level.key];
        return (
          <button
            key={level.key}
            type="button"
            onClick={() => !disabledReason && onSelect(level.key)}
            disabled={!!disabledReason}
            aria-label={disabledReason ? `${level.label} (${disabledReason})` : level.label}
            aria-current={isActive ? "true" : undefined}
            title={disabledReason ?? level.label}
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors focus-ring shrink-0"
            style={
              isActive
                ? { background: "linear-gradient(180deg, #4a3a10 0%, #2a2008 100%)", borderColor: "var(--ks-gold)", color: "var(--ks-gold-light)", boxShadow: "0 0 0 1px rgba(212,165,61,0.45), 0 0 20px rgba(212,165,61,0.3)" }
                : disabledReason
                  ? { borderColor: "var(--ks-bronze-dim)", color: "var(--ks-text-dim)", opacity: 0.4, cursor: "not-allowed" }
                  : { borderColor: "var(--ks-bronze)", color: "var(--ks-text-dim)" }
            }
          >
            <Icon size={18} />
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => step(1)}
        disabled={currentIndex >= LEVELS.length - 1}
        aria-label="Move down one level"
        className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 focus-ring"
        style={{ color: "var(--ks-text-dim)" }}
      >
        <ArrowDown size={15} />
      </button>
    </div>
  );
}
