import Link from "next/link";
import { Award, BarChart3, Trophy, Sparkles, Crown } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { SectionCard } from "@/components/ui/StatPill";
import { XpProgressBar } from "@/components/progression/XpProgressBar";
import {
  getMyProgressionSummary,
  getAllLevelThresholds,
  getMyBadgeAwards,
  getAllBadgeDefinitions,
  getMyGlobalRank,
  getMyChurchRank,
  getMyRecentProgressionAwards,
  ProgressionAwardLogEntry,
} from "@/services/supabase/progression";
import { getMyChurches } from "@/services/supabase/churches";
import { MemberBadgeAward, BadgeDefinition } from "@/types";
import { PROGRESSION_EVENT_LABELS } from "@/lib/progressionLabels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Phase 11.4 -- the real, Supabase-backed member dashboard, replacing the retired mock/localStorage
// version (spec SS34.5: "/dashboard is retired outright... its badge-summary traffic routes to
// /my-journey and the new /rewards/badges routes instead" -- this page IS that replacement, kept at
// the same route rather than adding a new one). Every number here comes directly from Phase 11.3's
// real tables/views -- no client-side calculation of a level, rank, or reward, and no localStorage
// fallback that could override a server-read value.
export default async function DashboardPage() {
  let pointsTotal = 0;
  let xpTotal = 0;
  let thresholds: Awaited<ReturnType<typeof getAllLevelThresholds>> = [];
  let badgeAwards: MemberBadgeAward[] = [];
  let badgeDefinitions: BadgeDefinition[] = [];
  let globalRank: Awaited<ReturnType<typeof getMyGlobalRank>> = null;
  let churchRank: Awaited<ReturnType<typeof getMyChurchRank>> = null;
  let recentAwards: ProgressionAwardLogEntry[] = [];
  let hasChurch = false;
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  // createClient() and the data-loading Promise.all each get their own try/catch so a thrown
  // redirect() signal (Next.js's internal control-flow throw) never lands inside a catch that
  // would swallow it and misreport a signed-out visit as a generic load failure.
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[DashboardPage] Failed to initialize Supabase client:", err);
      loadFailed = true;
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }
  if (loadFailed || !supabase) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your dashboard right now. Please try again shortly." />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  try {
    const [summary, thresholdRows, awards, definitions, myChurches, gRank, recent] = await Promise.all([
      getMyProgressionSummary(supabase),
      getAllLevelThresholds(supabase),
      getMyBadgeAwards(supabase),
      getAllBadgeDefinitions(supabase),
      getMyChurches(supabase),
      getMyGlobalRank(supabase),
      getMyRecentProgressionAwards(supabase, 8),
    ]);

    pointsTotal = summary?.pointsTotal ?? 0;
    xpTotal = summary?.xpTotal ?? 0;
    thresholds = thresholdRows;
    badgeAwards = awards;
    badgeDefinitions = definitions;
    globalRank = gRank;
    recentAwards = recent;
    hasChurch = myChurches.length > 0;

    if (hasChurch) {
      churchRank = await getMyChurchRank(supabase);
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[DashboardPage] Failed to load progression summary:", err);
      loadFailed = true;
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }
  if (loadFailed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your dashboard right now. Please try again shortly." />
      </div>
    );
  }

  const badgesById = new Map(badgeDefinitions.map((b) => [b.id, b]));
  const recentBadgeAwards = [...badgeAwards]
    .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime())
    .slice(0, 4);
  const nextBadge = badgeDefinitions
    .filter((b) => !b.isHiddenUntilEarned && !badgeAwards.some((a) => a.badgeId === b.id))
    .sort((a, b) => a.displayOrder - b.displayOrder)[0];

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">My Dashboard</h1>
      <p className="text-muted text-sm mb-6">Your Kingdom progress at a glance.</p>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <div className="qk-card px-4 py-3.5">
          <p className="text-xs text-muted mb-2">Level &amp; XP</p>
          <XpProgressBar xpTotal={xpTotal} thresholds={thresholds} />
        </div>
        <div className="qk-card px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center text-accent-gold shrink-0">
            <Trophy size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{pointsTotal.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">Lifetime Points</p>
            <p className="text-[10px] text-muted mt-0.5">Your leaderboard score -- never spent</p>
          </div>
        </div>
        <Link href="/leaderboard" className="qk-card px-4 py-3.5 flex items-center gap-3 hover:border-accent-blue-light/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue-light shrink-0">
            <BarChart3 size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{globalRank ? `#${globalRank.rank}` : "—"}</p>
            <p className="text-xs text-muted mt-1">Global Rank</p>
          </div>
        </Link>
        <Link href="/leaderboard" className="qk-card px-4 py-3.5 flex items-center gap-3 hover:border-accent-blue-light/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center text-accent-purple shrink-0">
            <Crown size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{hasChurch ? (churchRank ? `#${churchRank.rank}` : "—") : "—"}</p>
            <p className="text-xs text-muted mt-1">{hasChurch ? "Church Rank" : "No Church Yet"}</p>
          </div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Recent Badges" action="View all" actionHref="/badges" icon={Award}>
          {recentBadgeAwards.length === 0 ? (
            <EmptyState message="No badges earned yet. Keep studying, serving, and sharing your story." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentBadgeAwards.map((a) => {
                const badge = badgesById.get(a.badgeId);
                return (
                  <div key={a.id} className="qk-card p-3 text-center">
                    <div className="w-10 h-10 mx-auto rounded-full bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center mb-2 text-accent-gold">
                      {badge?.category === "trophy" ? <Trophy size={16} /> : <Award size={16} />}
                    </div>
                    <p className="text-xs font-medium text-foreground leading-tight">{badge?.name ?? "Badge"}</p>
                    <p className="text-[10px] text-muted mt-1">{formatDate(a.awardedAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
          {nextBadge && (
            <p className="text-[11px] text-muted mt-3 flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-blue-light shrink-0" /> Next milestone: {nextBadge.name}
            </p>
          )}
        </SectionCard>

        <SectionCard title="Recent Activity" icon={BarChart3}>
          {recentAwards.length === 0 ? (
            <EmptyState message="No progression activity yet." />
          ) : (
            <ul className="space-y-2.5">
              {recentAwards.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{PROGRESSION_EVENT_LABELS[a.eventType] ?? a.eventType}</span>
                  <span className="text-xs text-muted shrink-0">
                    {a.pointsAwarded > 0 && <span className="text-accent-gold">+{a.pointsAwarded} pts </span>}
                    {a.xpAwarded > 0 && <span className="text-accent-blue-light">+{a.xpAwarded} XP</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
