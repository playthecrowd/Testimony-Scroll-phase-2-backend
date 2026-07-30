import { createClient } from "@/lib/supabase/server";
import { getCurrentWeekCampaignLesson } from "@/services/supabase/lessons";
import { MemberPlotSliceHarness } from "@/components/kingdom-scrolls/mockup/memberPlotSlice/MemberPlotSliceHarness";

export const dynamic = "force-dynamic";

// Standalone Member Plot Vertical Slice prototype -- first checkpoint of the hybrid grid+art
// system (2026-07-28 clarification: the coordinate grid is core product functionality, never
// replaced by a static background). Not linked from any navigation, not part of the live
// Kingdom Scrolls route -- read-only use of the real campaign-lesson data (same query the real
// app uses), no writes, no live-app wiring.
export default async function MemberPlotSlicePage() {
  let dailyLessonTitle: string | null = null;
  let dailyLessonScripture: string | null = null;
  let dailyLessonHref: string | null = null;

  try {
    const supabase = await createClient();
    const currentLesson = await getCurrentWeekCampaignLesson(supabase);
    if (currentLesson) {
      dailyLessonTitle = currentLesson.title;
      dailyLessonScripture = currentLesson.primaryScripture;
      dailyLessonHref = `/lessons/${currentLesson.slug}`;
    }
  } catch (err) {
    console.error("[MemberPlotSlicePage] Failed to load current-week lesson:", err);
  }

  return (
    <MemberPlotSliceHarness dailyLessonTitle={dailyLessonTitle} dailyLessonScripture={dailyLessonScripture} dailyLessonHref={dailyLessonHref} />
  );
}
