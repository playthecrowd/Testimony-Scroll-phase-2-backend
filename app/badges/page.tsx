import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getAllBadgeDefinitions, getMyBadgeAwards } from "@/services/supabase/progression";
import { selectVisibleBadges } from "@/lib/badgePresentation";
import { BadgesGrid } from "@/components/progression/BadgesGrid";
import { BadgeDefinition, MemberBadgeAward } from "@/types";

export const dynamic = "force-dynamic";

// Phase 11.4 -- the real, Supabase-backed badge cabinet, replacing the retired mock version
// (data/badges.ts, services/badgeService.ts). Earned state is derived entirely from
// member_badge_awards; a badge with is_hidden_until_earned is simply excluded from this list until
// the member actually earns it (never shown as a locked mystery badge), matching the badge
// catalog's own design intent. is_active=false badges are excluded by getAllBadgeDefinitions
// itself (Phase 11.3) -- disabled badges are never shown to a member.
export default async function BadgesPage() {
  let badges: BadgeDefinition[] = [];
  let awards: MemberBadgeAward[] = [];
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fbadges");

    const [allBadges, myAwards] = await Promise.all([getAllBadgeDefinitions(supabase), getMyBadgeAwards(supabase)]);
    badges = selectVisibleBadges(allBadges, myAwards);
    awards = myAwards;
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[BadgesPage] Failed to load badges:", err);
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
        <ErrorState message="We couldn't load your badges right now. Please try again shortly." />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Award size={26} className="text-accent-gold" /> Badge Cabinet
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">Earn badges and trophies as you grow, serve, and share your story.</p>
      <BadgesGrid badges={badges} awards={awards} />
    </div>
  );
}
