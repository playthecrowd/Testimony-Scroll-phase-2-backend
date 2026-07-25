"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { ProgressionLeaderboardEntry } from "@/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/AsyncState";

// Phase 11.4: both leaderboard datasets are already fetched server-side
// (app/leaderboard/page.tsx) -- this component only switches which already-fetched list is shown,
// it never fetches anything itself. Points alone determine rank; only display name, Level, and
// Points are ever rendered here -- nothing from the account/economy side of the app.
export function LeaderboardTabs({
  myProfileId,
  globalEntries,
  churchEntries,
  myGlobalRank,
  myChurchRank,
  hasChurch,
}: {
  myProfileId: string | null;
  globalEntries: ProgressionLeaderboardEntry[];
  churchEntries: ProgressionLeaderboardEntry[] | null;
  myGlobalRank: ProgressionLeaderboardEntry | null;
  myChurchRank: ProgressionLeaderboardEntry | null;
  hasChurch: boolean;
}) {
  const [scope, setScope] = useState<"global" | "church">("global");
  const entries = scope === "church" ? churchEntries ?? [] : globalEntries;
  const myRank = scope === "church" ? myChurchRank : myGlobalRank;
  const myRankVisible = !!myRank && entries.some((e) => e.profileId === myRank.profileId);

  return (
    <div>
      <div role="tablist" aria-label="Leaderboard scope" className="flex items-center gap-1 rounded-lg border border-border-subtle p-1 mb-5 w-fit">
        <button
          type="button"
          role="tab"
          aria-selected={scope === "global"}
          onClick={() => setScope("global")}
          className={cn(
            "px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors",
            scope === "global" ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
          )}
        >
          Global
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "church"}
          disabled={!hasChurch}
          onClick={() => setScope("church")}
          className={cn(
            "px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors",
            scope === "church" ? "bg-accent-blue text-white" : "text-muted hover:text-foreground",
            !hasChurch && "opacity-50 cursor-not-allowed"
          )}
          title={hasChurch ? undefined : "Join a church to see your church leaderboard"}
        >
          My Church
        </button>
      </div>

      {!hasChurch && scope === "church" ? (
        <EmptyState message="You're not a member of a church yet, so there's no church leaderboard to show." />
      ) : entries.length === 0 ? (
        <EmptyState message={scope === "church" ? "No ranked members in your church yet." : "No leaderboard results yet."} />
      ) : (
        <>
          {myRank && !myRankVisible && (
            <div className="qk-card px-4 py-3 mb-3 flex items-center justify-between bg-accent-blue/10 border-accent-blue-light/40">
              <span className="text-sm text-accent-blue-light font-medium">Your rank: #{myRank.rank}</span>
              <span className="text-sm font-semibold text-foreground">{myRank.pointsTotal.toLocaleString()} pts</span>
            </div>
          )}
          <div className="qk-card overflow-hidden overflow-x-auto qk-scrollbar">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {scope === "global" ? "Global leaderboard ranked by lifetime Points" : "Your church's leaderboard ranked by lifetime Points"}
            </caption>
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border-subtle">
                <th scope="col" className="py-3 px-4 font-medium">Rank</th>
                <th scope="col" className="py-3 px-4 font-medium">Member</th>
                <th scope="col" className="py-3 px-4 font-medium">Level</th>
                <th scope="col" className="py-3 px-4 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = !!myProfileId && entry.profileId === myProfileId;
                return (
                  <tr
                    key={entry.profileId}
                    className={cn("border-b border-border-subtle/60 last:border-0", isMe && "bg-accent-blue/10")}
                  >
                    <td className="py-3 px-4 font-medium text-foreground">
                      {entry.rank <= 3 && <Crown size={13} className="text-accent-gold inline mr-1" aria-hidden="true" />}
                      {entry.rank}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(isMe ? "text-accent-blue-light font-semibold" : "text-foreground")}>
                        {entry.fullName ?? "A Kingdom Member"}
                        {isMe && <span className="text-[10px] font-normal text-muted"> (You)</span>}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted">{entry.currentLevel}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">{entry.pointsTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
