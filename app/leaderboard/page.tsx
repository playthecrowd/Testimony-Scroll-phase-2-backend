import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import {
  getGlobalLeaderboard,
  getMyChurchLeaderboard,
  getMyGlobalRank,
  getMyChurchRank,
} from "@/services/supabase/progression";
import { getMyChurches } from "@/services/supabase/churches";
import { LeaderboardTabs } from "@/components/progression/LeaderboardTabs";
import { ProgressionLeaderboardEntry } from "@/types";

export const dynamic = "force-dynamic";

// Phase 11.4 -- the real, Supabase-backed leaderboard, replacing the retired mock version
// (services/questService.ts's quest-score leaderboard). Ranks by lifetime Points only, reading
// directly from the leaderboard_global/leaderboard_my_church views (Phase 11.3) -- never a
// client-computed rank, and the church scope is derived entirely from the signed-in member's own
// church membership, never a client-supplied church id.
export default async function LeaderboardPage() {
  let myProfileId: string | null = null;
  let globalEntries: ProgressionLeaderboardEntry[] = [];
  let churchEntries: ProgressionLeaderboardEntry[] | null = null;
  let myGlobalRank: ProgressionLeaderboardEntry | null = null;
  let myChurchRank: ProgressionLeaderboardEntry | null = null;
  let hasChurch = false;
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fleaderboard");
    myProfileId = user.id;

    const [global, myChurches, gRank] = await Promise.all([
      getGlobalLeaderboard(supabase, 25),
      getMyChurches(supabase),
      getMyGlobalRank(supabase),
    ]);
    globalEntries = global;
    myGlobalRank = gRank;
    hasChurch = myChurches.length > 0;

    if (hasChurch) {
      const [church, cRank] = await Promise.all([getMyChurchLeaderboard(supabase, 25), getMyChurchRank(supabase)]);
      churchEntries = church;
      myChurchRank = cRank;
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[LeaderboardPage] Failed to load the leaderboard:", err);
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
        <ErrorState message="We couldn't load the leaderboard right now. Please try again shortly." />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Trophy size={26} className="text-accent-gold" /> Leaderboard
      </h1>
      <p className="text-muted text-sm mt-1 mb-5">See how Kingdom Members rank by lifetime Points.</p>
      <LeaderboardTabs
        myProfileId={myProfileId}
        globalEntries={globalEntries}
        churchEntries={churchEntries}
        myGlobalRank={myGlobalRank}
        myChurchRank={myChurchRank}
        hasChurch={hasChurch}
      />
    </div>
  );
}
