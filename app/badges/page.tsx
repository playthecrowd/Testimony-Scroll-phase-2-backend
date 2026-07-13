"use client";

import { useEffect, useState } from "react";
import { Award, Lock } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getAllBadges, getUserBadges } from "@/services/badgeService";
import { getLesson } from "@/services/lessonService";
import { UserBadge } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default function BadgesPage() {
  const { session, ready } = useSession();
  const [earned, setEarned] = useState<UserBadge[]>([]);
  const badges = getAllBadges();

  useEffect(() => {
    if (ready && session.isLoggedIn) setEarned(getUserBadges(session.user.id));
  }, [ready, session]);

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to view your badge cabinet.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.featuredSpeakers} opacity={0.35} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Award size={26} className="text-accent-gold" /> Badge Cabinet
      </h1>
      <p className="text-muted text-sm mt-1 mb-2">
        {earned.length} of {badges.length} badge types earned across your journeys.
      </p>
      <div className="h-2 rounded-full bg-surface-2 mb-6 overflow-hidden max-w-sm">
        <div className="h-full bg-accent-gold" style={{ width: `${(earned.length / badges.length) * 100}%` }} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((b) => {
          const instances = earned.filter((e) => e.badgeId === b.id);
          const has = instances.length > 0;
          return (
            <div key={b.id} className={cn("qk-card p-4", has && (b.color === "gold" ? "qk-glow-gold" : "qk-glow-blue"))}>
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center border mb-3",
                  has
                    ? b.color === "gold"
                      ? "bg-accent-gold/15 border-accent-gold/40 text-accent-gold"
                      : b.color === "purple"
                      ? "bg-accent-purple/15 border-accent-purple/40 text-accent-purple"
                      : "bg-accent-blue/15 border-accent-blue/40 text-accent-blue-light"
                    : "bg-surface-2 border-border-subtle text-muted"
                )}
              >
                {has ? <Award size={22} /> : <Lock size={18} />}
              </div>
              <p className="text-sm font-semibold text-foreground">{b.name}</p>
              <p className="text-xs text-muted mt-1 mb-3">{b.description}</p>
              {has ? (
                <div className="space-y-1">
                  {instances.slice(0, 3).map((i) => {
                    const lesson = i.lessonId ? getLesson(i.lessonId) : undefined;
                    return (
                      <p key={i.id} className="text-[11px] text-accent-blue-light">
                        {lesson ? lesson.title : "Kingdom-wide"} · {formatDate(i.earnedAt)}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted">Not yet earned</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
