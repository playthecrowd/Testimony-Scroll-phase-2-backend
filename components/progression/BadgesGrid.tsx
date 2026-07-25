"use client";

import { useState } from "react";
import { Award, Trophy, Lock } from "lucide-react";
import { BadgeDefinition, MemberBadgeAward } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/AsyncState";

// Phase 11.4: client-side category filter only -- the badge catalog and award data are both
// already fetched server-side (app/badges/page.tsx); this component never fetches anything itself,
// it only filters what it was given.
type CategoryFilter = "all" | "achievement" | "trophy";

export function BadgesGrid({ badges, awards }: { badges: BadgeDefinition[]; awards: MemberBadgeAward[] }) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const awardsByBadgeId = new Map(awards.map((a) => [a.badgeId, a]));

  const visible = badges.filter((b) => filter === "all" || b.category === filter);
  const earnedCount = badges.filter((b) => awardsByBadgeId.has(b.id) && !awardsByBadgeId.get(b.id)!.revokedAt).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-muted">
          {earnedCount} of {badges.length} badges earned
        </p>
        <div role="tablist" aria-label="Filter badges by category" className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
          {(["all", "achievement", "trophy"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
                filter === f ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
              )}
            >
              {f === "all" ? "All" : f === "trophy" ? "Trophies" : "Achievements"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState message="No badges in this category yet." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((badge) => {
            const award = awardsByBadgeId.get(badge.id);
            const earned = !!award && !award.revokedAt;
            const isTrophy = badge.category === "trophy";
            return (
              <div
                key={badge.id}
                className={cn("qk-card p-4", earned && (isTrophy ? "qk-glow-gold" : "qk-glow-blue"))}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border",
                      earned
                        ? isTrophy
                          ? "bg-accent-gold/15 border-accent-gold/40 text-accent-gold"
                          : "bg-accent-blue/15 border-accent-blue/40 text-accent-blue-light"
                        : "bg-surface-2 border-border-subtle text-muted"
                    )}
                    aria-hidden="true"
                  >
                    {earned ? isTrophy ? <Trophy size={22} /> : <Award size={22} /> : <Lock size={18} />}
                  </div>
                  {isTrophy && (
                    <span className="text-[10px] uppercase tracking-wide text-accent-gold font-semibold shrink-0">Trophy</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">{badge.name}</p>
                {badge.description && <p className="text-xs text-muted mt-1">{badge.description}</p>}
                <p className={cn("text-[11px] mt-3", earned ? "text-accent-blue-light" : "text-muted")}>
                  {earned ? `Earned ${formatDate(award!.awardedAt)}` : "Not yet earned"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
