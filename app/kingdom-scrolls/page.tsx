import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyChurches } from "@/services/supabase/churches";
import { getCurrentWeekCampaignLesson } from "@/services/supabase/lessons";
import { getMyProgressionSummary } from "@/services/supabase/progression";
import { KingdomScrollsWorld } from "@/components/kingdom-scrolls/KingdomScrollsWorld";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Kingdom Scrolls | Quest for the Kingdom",
  description: "Explore the Upper Kingdom, descend to your church's land, and walk your daily lesson as a Scroll Seeker.",
};

// Public route: signed-out visitors get the Upper Kingdom + a sign-in prompt (Section 19 --
// "Signed-out visitors can view public lands, pan and zoom, begin the join process"). Every
// deeper level (Church Land, My Plot, inventory, missions) is gated behind real data below, not a
// hidden client button -- a visitor with no session simply has hasChurch=false and dailyLesson
// unset, so KingdomScrollsWorld renders its own honest empty/locked states.
export default async function KingdomScrollsPage() {
  let isSignedIn = false;
  let profileId: string | null = null;
  let displayName = "Scroll Seeker";
  let avatarUrl: string | null = null;
  let level: number | null = null;
  let xpTotal: number | null = null;
  let pointsTotal: number | null = null;
  let hasChurch = false;
  let churchName: string | null = null;
  let dailyLessonTitle: string | null = null;
  let dailyLessonHref: string | null = null;
  let dailyLessonScripture: string | null = null;
  let dailyLessonMonth: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isSignedIn = true;
      profileId = user.id;

      const [{ data: profile }, churches, currentLesson, progression] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
        getMyChurches(supabase),
        getCurrentWeekCampaignLesson(supabase).catch((err) => {
          console.error("[KingdomScrollsPage] Failed to load current-week lesson:", err);
          return null;
        }),
        getMyProgressionSummary(supabase).catch((err) => {
          console.error("[KingdomScrollsPage] Failed to load progression summary:", err);
          return null;
        }),
      ]);

      displayName = profile?.full_name || displayName;
      avatarUrl = profile?.avatar_url ?? null;
      hasChurch = churches.length > 0;
      churchName = churches[0]?.name ?? null;
      level = progression?.currentLevel ?? null;
      xpTotal = progression?.xpTotal ?? null;
      pointsTotal = progression?.pointsTotal ?? null;

      if (currentLesson) {
        dailyLessonTitle = currentLesson.title;
        dailyLessonHref = `/lessons/${currentLesson.slug}`;
        dailyLessonScripture = currentLesson.campaignWeeklyVerse || currentLesson.primaryScripture || null;
        dailyLessonMonth = currentLesson.campaignMonth
          ? `${currentLesson.campaignMonth}${currentLesson.campaignWeekNumber ? ` · Week ${currentLesson.campaignWeekNumber}` : ""}`
          : null;
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    // A signed-out or partially-failed load must still render the Upper Kingdom rather than
    // crash the whole route -- same rule as the homepage.
    console.error("[KingdomScrollsPage] Failed to load Kingdom Scrolls data:", err);
  }

  return (
    <KingdomScrollsWorld
      isSignedIn={isSignedIn}
      profileId={profileId}
      displayName={displayName}
      avatarUrl={avatarUrl}
      level={level}
      xpTotal={xpTotal}
      pointsTotal={pointsTotal}
      hasChurch={hasChurch}
      churchName={churchName}
      dailyLesson={
        dailyLessonTitle && dailyLessonHref
          ? { title: dailyLessonTitle, href: dailyLessonHref, scripture: dailyLessonScripture, monthLabel: dailyLessonMonth }
          : null
      }
    />
  );
}
