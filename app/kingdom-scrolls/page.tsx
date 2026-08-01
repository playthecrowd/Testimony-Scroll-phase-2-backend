import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, Lock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getPublishedLessons } from "@/services/supabase/lessons";
import { getMyCompletedLessonCount, getUserJourneysWithLessons } from "@/services/supabase/journeys";
import { PLACEABLE_CATALOG } from "@/components/kingdom-scrolls/mockup/memberPlotSlice/placeableCatalog";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Kingdom Scrolls | Quest for the Kingdom",
  description: "Complete two lessons to unlock Inventory Land, your own plot in the Kingdom Scrolls world.",
};

const UNLOCK_THRESHOLD = 2;
const LESSON_LIST_LIMIT = 12;

type LessonStatus = "completed" | "in-progress" | "available";

// Public route, same rule as the previous production entry point: a signed-out visitor sees the
// Gateway shell with a sign-in prompt, not a hidden/blocked page -- every deeper level (real
// progress, Inventory Land) is gated behind real data below, never a client-only check.
//
// This page is the Trailer/Introduction Gateway (required flow: Kingdom Scrolls navigation ->
// Gateway -> Lessons Available + Seeker Inventory sidebars -> two-lesson progress message ->
// Continue to Inventory Land). It replaces the world-map experience (KingdomScrollsWorld /
// components/kingdom-scrolls/KingdomScrollsWorld.tsx) that previously lived at this route -- that
// component is left completely untouched and unlinked, reserved for future immersive gameplay per
// the standing "world expansion paused" instruction, not deleted.
export default async function KingdomScrollsPage() {
  let isSignedIn = false;
  let completedCount = 0;
  let lessonRows: { title: string; slug: string; id: string; status: LessonStatus }[] = [];
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isSignedIn = true;

      const [count, lessons, journeysWithLessons] = await Promise.all([
        getMyCompletedLessonCount(supabase),
        getPublishedLessons(supabase),
        getUserJourneysWithLessons(supabase),
      ]);

      completedCount = count;

      const journeyByLessonId = new Map(journeysWithLessons.map((jw) => [jw.lesson.id, jw.journey]));
      lessonRows = lessons.slice(0, LESSON_LIST_LIMIT).map((lesson) => {
        const journey = journeyByLessonId.get(lesson.id);
        const status: LessonStatus = journey?.completedAt ? "completed" : journey ? "in-progress" : "available";
        return { title: lesson.title, slug: lesson.slug, id: lesson.id, status };
      });
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[KingdomScrollsPage] Failed to load Kingdom Scrolls Gateway data:", err);
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
        <ErrorState message="We couldn't load the Kingdom Scrolls Gateway right now. Please try again shortly." />
      </div>
    );
  }

  const unlocked = completedCount >= UNLOCK_THRESHOLD;
  const progressPct = Math.min(100, Math.round((completedCount / UNLOCK_THRESHOLD) * 100));

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.4} />

      <div className="qk-card p-6 md:p-8 mb-6 text-center">
        <p className="text-xs uppercase tracking-wide text-accent-blue-light font-semibold mb-2">Trailer &amp; Introduction</p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Welcome to the Kingdom Scrolls</h1>
        <p className="text-sm text-muted max-w-2xl mx-auto">
          Every lesson you complete brings you closer to Inventory Land -- your own plot in the Kingdom, where you&apos;ll place
          your starter Lesson Relics. Complete two distinct lessons to unlock it.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <div className="qk-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Your Progress</h2>
            {isSignedIn ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-3xl font-bold text-accent-blue-light">
                    {Math.min(completedCount, UNLOCK_THRESHOLD)}
                    <span className="text-muted text-lg"> / {UNLOCK_THRESHOLD}</span>
                  </p>
                  <p className="text-sm text-muted">lessons completed toward Inventory Land</p>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden mb-4">
                  <div className="h-full bg-accent-blue transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                {unlocked ? (
                  <div className="qk-card p-4 qk-glow-blue">
                    <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <Sparkles size={15} className="text-accent-gold" /> Inventory Land is unlocked!
                    </p>
                    <p className="text-xs text-muted mb-3">
                      You&apos;ve completed {completedCount} lesson{completedCount === 1 ? "" : "s"}. Continue to place your starter
                      relics.
                    </p>
                    <LinkButton href="/kingdom-scrolls/inventory-land" className="w-full justify-center" aria-label="Go To Inventory Plot">
                      Go To Inventory Plot
                    </LinkButton>
                  </div>
                ) : (
                  <div className="qk-card p-4">
                    <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <Lock size={14} className="text-muted" /> Inventory Land is locked
                    </p>
                    <p className="text-xs text-muted">
                      Complete {UNLOCK_THRESHOLD - completedCount} more distinct lesson{UNLOCK_THRESHOLD - completedCount === 1 ? "" : "s"} to
                      unlock it. Pick a lesson from Lessons Available and finish its Studied checklist.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="qk-card p-4">
                <p className="text-sm text-foreground mb-3">Sign in to start tracking your progress toward Inventory Land.</p>
                <LinkButton href={`/login?next=${encodeURIComponent("/kingdom-scrolls")}`} className="w-full justify-center">
                  Sign In
                </LinkButton>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Lessons Available</h3>
            {isSignedIn ? (
              lessonRows.length === 0 ? (
                <p className="text-xs text-muted">No published lessons yet -- check back soon.</p>
              ) : (
                <ul className="space-y-2">
                  {lessonRows.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={row.status === "available" ? `/lessons/${row.slug}` : `/journey/${row.id}/studied`}
                        className="flex items-center gap-2 text-sm py-1.5 group"
                      >
                        {row.status === "completed" ? (
                          <CheckCircle2 size={15} className="text-accent-blue-light shrink-0" />
                        ) : row.status === "in-progress" ? (
                          <Circle size={15} className="text-accent-gold shrink-0" />
                        ) : (
                          <Circle size={15} className="text-muted shrink-0" />
                        )}
                        <span
                          className={cn(
                            "flex-1 truncate group-hover:text-accent-blue-light transition-colors",
                            row.status === "completed" ? "text-foreground" : "text-muted"
                          )}
                        >
                          {row.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-xs text-muted">Sign in to see your lessons.</p>
            )}
            <Link href="/lessons" className="inline-block text-xs text-accent-blue-light hover:underline mt-3">
              View All Lessons
            </Link>
          </div>

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Seeker Inventory</h3>
            <p className="text-[11px] text-muted mb-3">
              Beta starter items -- these 6 Lesson Relics are what you&apos;ll place in Inventory Land once it&apos;s unlocked. The full
              reward catalog and real item ownership are coming in a future update.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PLACEABLE_CATALOG.map((item) => (
                <div key={item.assetId} className="qk-card p-2 flex flex-col items-center gap-1" title={item.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.assetPath} alt="" className="w-10 h-10 object-contain" />
                  <span className="text-[9px] text-center leading-tight text-muted">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
