import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getCurrentWeekCampaignLesson } from "@/services/supabase/lessons";
import { getMyProgressionSummary } from "@/services/supabase/progression";
import { getMyCompletedLessonCount } from "@/services/supabase/journeys";
import { InventoryLandHarness } from "@/components/kingdom-scrolls/inventoryLand/InventoryLandHarness";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory Land | Quest for the Kingdom",
  description: "Place your starter Lesson Relics on your own plot of the Kingdom.",
};

const UNLOCK_THRESHOLD = 2;

// Server-side enforcement of the two-distinct-completed-lessons unlock -- not just a disabled
// button on the Gateway. getMyCompletedLessonCount counts lesson_journeys rows with completed_at
// not null (server-computed and immutable, migration 0042), so this check cannot be bypassed by
// navigating here directly. Signed-out visitors and members under the threshold are both sent back
// to the Gateway, which explains why in either case.
//
// redirect()/notFound() must never be called from inside a try/catch that doesn't re-throw them
// (see app/journey/[lessonId]/studied/page.tsx for why) -- every Supabase call happens in the try
// below, every control-flow decision happens after it, outside the try.
export default async function InventoryLandPage() {
  let userId: string | null = null;
  let profile: { full_name: string | null; avatar_url: string | null } | null = null;
  let completedCount = 0;
  let level: number | null = null;
  let xpTotal: number | null = null;
  let pointsTotal: number | null = null;
  let dailyLessonTitle: string | null = null;
  let dailyLessonHref: string | null = null;
  let dailyLessonScripture: string | null = null;
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      const [{ data: profileRow }, count, progression, currentLesson] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle(),
        getMyCompletedLessonCount(supabase),
        getMyProgressionSummary(supabase).catch((err) => {
          console.error("[InventoryLandPage] Failed to load progression summary:", err);
          return null;
        }),
        getCurrentWeekCampaignLesson(supabase).catch((err) => {
          console.error("[InventoryLandPage] Failed to load current-week lesson:", err);
          return null;
        }),
      ]);

      profile = profileRow;
      completedCount = count;
      level = progression?.currentLevel ?? null;
      xpTotal = progression?.xpTotal ?? null;
      pointsTotal = progression?.pointsTotal ?? null;

      if (currentLesson) {
        dailyLessonTitle = currentLesson.title;
        dailyLessonHref = `/lessons/${currentLesson.slug}`;
        dailyLessonScripture = currentLesson.campaignWeeklyVerse || currentLesson.primaryScripture || null;
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[InventoryLandPage] Failed to load Inventory Land data:", err);
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
        <ErrorState message="We couldn't load Inventory Land right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect(`/login?next=${encodeURIComponent("/kingdom-scrolls/inventory-land")}`);
  if (completedCount < UNLOCK_THRESHOLD) redirect("/kingdom-scrolls");

  return (
    <InventoryLandHarness
      profileId={userId}
      displayName={profile?.full_name || "Scroll Seeker"}
      avatarUrl={profile?.avatar_url ?? null}
      level={level}
      xpTotal={xpTotal}
      pointsTotal={pointsTotal}
      dailyLessonTitle={dailyLessonTitle}
      dailyLessonScripture={dailyLessonScripture}
      dailyLessonHref={dailyLessonHref}
    />
  );
}
