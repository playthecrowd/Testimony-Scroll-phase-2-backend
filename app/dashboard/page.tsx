"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  Box,
  Feather,
  ScrollText,
  Award,
  CheckCircle2,
  Lock,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getUserJourneys } from "@/services/journeyService";
import { getUserBadges, getAllBadges } from "@/services/badgeService";
import { getUserNotifications } from "@/services/notificationService";
import { getUserQuestResult } from "@/services/questService";
import { getLesson } from "@/services/lessonService";
import { getBadgeById } from "@/data/badges";
import { StatPill, SectionCard } from "@/components/ui/StatPill";
import { stages, stageStatus } from "@/components/journey/stageMeta";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { Journey } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";

export default function DashboardPage() {
  const { session, ready } = useSession();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (ready && session.isLoggedIn) {
      setJourneys(getUserJourneys(session.user.id));
    }
  }, [ready, session, tick]);

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You need to sign in to view your dashboard.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const userId = session.user.id;
  const badges = getUserBadges(userId);
  const notifications = getUserNotifications(userId).filter((n) => n.type === "testimony-invitation");
  const activeJourney = journeys.find((j) => j.stage !== "added-to-story") ?? journeys[0];
  const completedLessons = journeys.filter((j) => stageStatus(j.stage, "studied") === "completed" || j.stage === "studied");
  const totalBadges = getAllBadges().length;

  const overallStage = journeys.reduce<Journey["stage"]>((acc, j) => {
    const order = ["not-started", "captured", "studied", "experienced", "applied", "added-to-story"];
    return order.indexOf(j.stage) > order.indexOf(acc) ? j.stage : acc;
  }, "not-started");

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.22} />
      <div className="qk-card p-5 md:p-6 mb-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Welcome back, {session.user.fullName.split(" ")[0]} 👋</h1>
            <p className="text-muted text-sm mt-1">Every lesson you capture moves the Kingdom forward.</p>
          </div>
          <div className="qk-card px-4 py-2.5 text-xs italic text-muted max-w-xs">
            &ldquo;Train up a child in the way he should go...&rdquo;
            <span className="block not-italic text-[11px] mt-1 text-accent-blue-light">— Proverbs 22:6</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <LinkButton href="/lessons">Find a Lesson</LinkButton>
        <LinkButton href="/request-lesson" variant="secondary">
          Request a Lesson
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatPill icon={Box} value={journeys.length} label="Lessons Captured" />
        <StatPill icon={BookOpen} value={completedLessons.length} label="Lessons Studied" />
        <StatPill
          icon={Trophy}
          value={journeys.filter((j) => !!j.questResultId).length}
          label="Quests Completed"
        />
        <StatPill icon={Feather} value={journeys.filter((j) => !!j.testimonyId).length} label="Testimonies Submitted" />
        <StatPill icon={ScrollText} value={journeys.filter((j) => j.stage === "added-to-story").length} label="Story Contributions" />
        <StatPill icon={Award} value={badges.length} label="Total Badges" />
      </div>

      {/* Journey progress */}
      <SectionCard title="My Journey Progress" icon={BookMarked}>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {stages.map((s, i) => {
            const status = stageStatus(overallStage, s.key);
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border",
                    status === "completed" && "bg-accent-blue/20 border-accent-blue text-accent-blue-light",
                    status === "in-progress" && "border-accent-blue-light text-accent-blue-light qk-glow-blue",
                    (status === "available" || status === "locked") && "border-border-subtle text-muted"
                  )}
                >
                  {status === "completed" ? <CheckCircle2 size={16} /> : status === "locked" ? <Lock size={13} /> : <s.icon size={15} />}
                </div>
                <span className="text-xs text-muted hidden sm:block">{s.label}</span>
                {i < stages.length - 1 && <ChevronRight size={14} className="text-muted" />}
              </div>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stages.map((s) => {
            const badge = getBadgeById(`badge-${s.key === "added-to-story" ? "added-to-story" : s.key}`);
            const earned = badges.some((b) => b.badgeId === badge?.id);
            return (
              <div key={s.key} className={cn("qk-card p-3 text-center", earned && "qk-glow-blue")}>
                <div className="w-10 h-10 mx-auto rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center mb-2">
                  <Award size={16} className={earned ? "text-accent-blue-light" : "text-muted"} />
                </div>
                <p className="text-xs font-medium text-foreground leading-tight">{badge?.name}</p>
                <p className={cn("text-[11px] mt-1", earned ? "text-accent-blue-light" : "text-muted")}>
                  {earned ? "Earned" : stageStatus(overallStage, s.key) === "in-progress" ? "In Progress" : "Locked"}
                </p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <SectionCard title="Continue Your Journey" icon={Box}>
          {activeJourney ? (
            <ContinueCard journey={activeJourney} />
          ) : (
            <p className="text-sm text-muted">Start your first lesson to begin your journey.</p>
          )}
        </SectionCard>

        <SectionCard title="My Completed Lessons" action="View all" actionHref="/my-journey" icon={BookOpen}>
          <div className="space-y-3">
            {completedLessons.slice(0, 4).map((j) => {
              const lesson = getLesson(j.lessonId);
              if (!lesson) return null;
              return (
                <Link key={j.id} href={`/lessons/${lesson.slug}`} className="flex items-center gap-2.5 group">
                  <img src={lesson.featuredImageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-accent-blue-light">{lesson.title}</p>
                    <p className="text-[11px] text-muted">{formatDate(j.studiedAt ?? j.startedAt)}</p>
                  </div>
                  <CheckCircle2 size={15} className="text-accent-blue-light shrink-0" />
                </Link>
              );
            })}
            {completedLessons.length === 0 && <p className="text-sm text-muted">No completed lessons yet.</p>}
          </div>
        </SectionCard>

        <SectionCard title="My Quest Results" action="View all" actionHref="/leaderboard" icon={Trophy}>
          <QuestResultsSummary journeys={journeys} userId={userId} />
        </SectionCard>

        <SectionCard title="Testimony Invitations" action="View All Invitations" actionHref="/contribute" icon={Feather}>
          <div className="space-y-3">
            {notifications.slice(0, 3).map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2">
                <p className="text-xs text-foreground leading-snug">{n.message}</p>
                <Link href="/contribute" className="shrink-0 text-[11px] px-2.5 py-1 rounded-md border border-border-subtle hover:border-accent-blue-light text-foreground">
                  Respond
                </Link>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-muted">No invitations right now.</p>}
          </div>
        </SectionCard>

        <SectionCard title="My Kingdom Badges" action="View all" actionHref="/badges" icon={Award}>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {badges.slice(0, 8).map((b) => {
              const meta = getBadgeById(b.badgeId);
              return (
                <div key={b.id} className="aspect-square rounded-lg bg-surface-2 border border-accent-blue/30 flex items-center justify-center" title={meta?.name}>
                  <Award size={16} className="text-accent-blue-light" />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            {badges.length} / {totalBadges} Badges Earned
          </p>
          <div className="h-1.5 rounded-full bg-surface-2 mt-1.5 overflow-hidden">
            <div className="h-full bg-accent-blue" style={{ width: `${(badges.length / totalBadges) * 100}%` }} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ContinueCard({ journey }: { journey: Journey }) {
  const lesson = getLesson(journey.lessonId);
  if (!lesson) return null;
  return (
    <Link href={`/journey/${lesson.id}/${journey.stage === "captured" ? "studied" : journey.stage}`} className="block group">
      <div className="relative aspect-video rounded-lg overflow-hidden bg-surface-2 mb-2.5">
        <img src={lesson.featuredImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        <span className="absolute top-2 left-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">In Progress</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{lesson.title}</p>
      <p className="text-xs text-muted mb-2">{lesson.shortDescription}</p>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-3">
        <div className="h-full bg-accent-blue" style={{ width: `${journey.progressPercent}%` }} />
      </div>
      <span className="inline-flex items-center justify-center w-full text-sm font-medium text-white bg-accent-blue rounded-lg py-2 gap-1.5">
        Continue Quest <ChevronRight size={15} />
      </span>
    </Link>
  );
}

function QuestResultsSummary({ journeys, userId }: { journeys: Journey[]; userId: string }) {
  const results = journeys.map((j) => (j.lessonId ? getUserQuestResult(userId, j.lessonId) : undefined)).filter(Boolean);
  const completed = results.length;
  const avgScore = completed
    ? Math.round(results.reduce((acc, r) => acc + (r?.score ?? 0), 0) / completed)
    : 0;
  return (
    <div className="space-y-2.5 text-sm">
      <Row label="Quests Completed" value={completed} icon={Trophy} />
      <Row label="Average Score" value={avgScore.toLocaleString()} icon={Award} />
      <Row label="Total XP Earned" value={`${avgScore * completed || 0} XP`} icon={Box} />
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted text-xs">
        <Icon size={14} /> {label}
      </span>
      <span className="text-foreground font-semibold text-xs">{value}</span>
    </div>
  );
}
