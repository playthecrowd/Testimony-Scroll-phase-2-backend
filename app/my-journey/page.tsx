"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map, Lock, CheckCircle2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getUserJourneysWithLessons, UserJourneyWithLesson } from "@/services/supabase/journeys";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { stages, stageStatus } from "@/components/journey/stageMeta";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { LoadingState, ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function MyJourneyPage() {
  const { session, ready } = useSession();
  const [journeys, setJourneys] = useState<UserJourneyWithLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!session.isLoggedIn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const rows = await getUserJourneysWithLessons(supabase);
        if (!cancelled) {
          setJourneys(rows);
          setError("");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SupabaseConfigError) {
          setError(err.message);
        } else {
          console.error("[MyJourneyPage] Failed to load journeys:", err);
          setError("We couldn't load your journeys right now. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to view your journey.</p>
        <LinkButton href="/login?next=%2Fmy-journey">Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.chooseHowToJoin} opacity={0.3} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Map size={26} className="text-accent-blue-light" /> My Journey
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">
        Every lesson has its own journey record — Captured, Studied, Experienced, Applied, Added to the Story.
      </p>

      {loading ? (
        <LoadingState label="Loading your journeys..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="space-y-4">
          {journeys.map(({ journey, lesson }) => {
            return (
              <div key={journey.id} className="qk-card p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <LessonThumbnail
                    src={lesson.featuredImageUrl}
                    alt={lesson.featuredImageAlt}
                    className="w-full sm:w-28"
                    aspect="square"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-foreground truncate">{lesson.title}</h3>
                      <span className="text-xs text-muted shrink-0">{lesson.church.name}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      {journey.studiedCompletedAt ? "Studied stage complete" : "Studied stage in progress"}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {stages.map((s) => {
                        const status = stageStatus(journey.currentStage, s.key);
                        const clickable = status !== "locked";
                        const content = (
                          <span
                            className={cn(
                              "flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full border",
                              status === "completed" && "border-accent-blue/40 bg-accent-blue/10 text-accent-blue-light",
                              status === "in-progress" && "border-accent-blue-light text-accent-blue-light bg-accent-blue/15",
                              status === "available" && "border-border-subtle text-foreground",
                              status === "locked" && "border-border-subtle text-muted opacity-60"
                            )}
                          >
                            {status === "completed" ? <CheckCircle2 size={11} /> : status === "locked" ? <Lock size={10} /> : null}
                            {s.label}
                          </span>
                        );
                        // Every stage route (studied, plus the coming-soon fallback on the rest)
                        // safely handles a real lesson UUID now -- no journey link can 404.
                        return clickable ? (
                          <Link key={s.key} href={`/journey/${lesson.id}/${s.key}`}>
                            {content}
                          </Link>
                        ) : (
                          <span key={s.key}>{content}</span>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <LinkButton href={`/journey/${lesson.id}/studied`} size="sm">
                        {journey.currentStage === "studied" ? "Continue Your Journey" : "View Journey"}
                      </LinkButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {journeys.length === 0 && (
            <div className="qk-card p-10 text-center">
              <p className="text-muted text-sm mb-4">You haven&apos;t started a journey yet.</p>
              <LinkButton href="/lessons">Browse Lessons</LinkButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
