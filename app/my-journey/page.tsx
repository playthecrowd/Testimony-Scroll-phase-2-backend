"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map, Lock, CheckCircle2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getUserJourneys } from "@/services/journeyService";
import { getLesson } from "@/services/lessonService";
import { stages, stageStatus } from "@/components/journey/stageMeta";
import { Journey } from "@/types";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function MyJourneyPage() {
  const { session, ready } = useSession();
  const [journeys, setJourneys] = useState<Journey[]>([]);

  useEffect(() => {
    if (ready && session.isLoggedIn) setJourneys(getUserJourneys(session.user.id));
  }, [ready, session]);

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to view your journey.</p>
        <LinkButton href="/login">Sign In</LinkButton>
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

      <div className="space-y-4">
        {journeys.map((j) => {
          const lesson = getLesson(j.lessonId);
          if (!lesson) return null;
          return (
            <div key={j.id} className="qk-card p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <img src={lesson.featuredImageUrl} className="w-full sm:w-28 aspect-video sm:aspect-square rounded-lg object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-foreground truncate">{lesson.title}</h3>
                    <span className="text-xs text-accent-blue-light font-medium shrink-0">{j.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 mt-2 mb-3 overflow-hidden">
                    <div className="h-full bg-accent-blue" style={{ width: `${j.progressPercent}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((s) => {
                      const status = stageStatus(j.stage, s.key);
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
                      return clickable ? (
                        <Link key={s.key} href={`/journey/${lesson.id}/${s.key}`}>
                          {content}
                        </Link>
                      ) : (
                        <span key={s.key}>{content}</span>
                      );
                    })}
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
    </div>
  );
}
