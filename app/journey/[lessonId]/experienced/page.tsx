"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CheckCircle2, Feather, Crown, Award, FlaskConical } from "lucide-react";
import { StageComingSoon } from "@/components/journey/StageComingSoon";
import { getLesson } from "@/services/lessonService";
import { useSession } from "@/context/SessionContext";
import { getJourney, startJourney, completeExperienced } from "@/services/journeyService";
import { getUserQuestResult, simulateQuestCompletion, getLeaderboard } from "@/services/questService";
import { getUserById, demoMember } from "@/data/users";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { Button, LinkButton } from "@/components/ui/Button";
import { Journey, QuestResult } from "@/types";
import { cn } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

const leaderboardTabs = ["Global", "My Church", "This Lesson"] as const;

export default function ExperiencedStagePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = getLesson(lessonId);
  const { session, ready } = useSession();
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [result, setResult] = useState<QuestResult | undefined>();
  const [lbTab, setLbTab] = useState<(typeof leaderboardTabs)[number]>("Global");

  // Mock/demo route (services/journeyService, localStorage-backed) -- deferred for a real
  // Supabase-backed rebuild in a later member-journey phase, see docs/PHASE9_5_STABILIZATION.md.
  // startedForLessonRef guards the mutating startJourney() call so React Strict Mode's dev-only
  // double-invoke of this effect can't create two journey records for the same lesson; the
  // queueMicrotask defers the state updates out of the effect's synchronous commit phase.
  const startedForLessonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!(ready && session.isLoggedIn && lesson)) return;
    if (startedForLessonRef.current === lesson.id) return;
    startedForLessonRef.current = lesson.id;
    queueMicrotask(() => {
      let j = getJourney(session.user.id, lesson.id);
      if (!j) j = startJourney(session.user.id, lesson.id);
      setJourney(j);
      setResult(getUserQuestResult(session.user.id, lesson.id));
    });
  }, [ready, session, lesson]);

  if (!lesson) return <StageComingSoon stageLabel="Experienced" />;
  if (!ready) return null;
  if (!session.isLoggedIn) {
    router.push("/login");
    return null;
  }
  if (!journey) return null;

  const hostId = lesson.hostSessions[0]?.hostId ?? "host-radiant-life";

  function runSimulation() {
    const r = simulateQuestCompletion(session.user.id, lesson!.id, hostId);
    setResult(r);
    const updated = completeExperienced(session.user.id, lesson!.id, r.id);
    setJourney(updated);
  }

  const leaderboard = getLeaderboard(lbTab === "This Lesson" ? lesson.id : undefined).filter((entry) => {
    if (lbTab === "My Church") {
      const u = getUserById(entry.userId) ?? demoMember;
      return u.churchId === session.user.churchId;
    }
    return true;
  });

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.chooseHowToJoin} opacity={0.45} />
      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId={lesson.id} currentStage={journey.stage} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mb-8">
        <div className="qk-card p-5 flex flex-col sm:flex-row gap-5 min-w-0">
          <div className="relative sm:w-56 aspect-video sm:aspect-square rounded-xl overflow-hidden bg-surface-2 shrink-0">
            <img src={lesson.featuredImageUrl} className="w-full h-full object-cover" alt="" />
            {lesson.questLevel && (
              <span className="absolute top-2 left-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                Level {lesson.questLevel}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{lesson.title}</h1>
            <p className="text-muted text-sm mt-1">{lesson.shortDescription}</p>

            {result ? (
              <div>
                <div className="flex items-center gap-2 mt-4 text-accent-blue-light">
                  <CheckCircle2 size={18} />
                  <span className="font-semibold text-sm">Quest Completed</span>
                </div>
                <p className="text-xs text-muted mb-3">Well done, Kingdom Member! You have completed the quest.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <QuestStat label="Total Score" value={result.score.toLocaleString()} />
                  <QuestStat label="Completion Time" value={result.completionTime} />
                  <QuestStat label="Correct Answers" value={`${result.correctAnswers}/${result.totalQuestions}`} />
                  <QuestStat label="Objects Collected" value={`${result.objectsCollected}/${result.objectsTotal}`} />
                </div>
                {journey.stage === "experienced" && (
                  <LinkButton href={`/journey/${lesson.id}/applied`} className="mt-4">
                    <Feather size={16} /> Submit Your Testimony
                  </LinkButton>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-muted mb-3">
                  This dev control simulates completing the connected 3D Quest experience.
                </p>
                <Button onClick={runSimulation}>
                  <FlaskConical size={16} /> Simulate Quest Completion
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="qk-card p-4 text-center">
          <h3 className="text-sm font-semibold text-foreground mb-3">Quest Experience Badge</h3>
          <div className={cn("w-24 h-24 mx-auto rounded-2xl flex items-center justify-center border", result ? "bg-accent-purple/15 border-accent-purple/40 qk-glow-blue" : "bg-surface-2 border-border-subtle")}>
            <Box size={34} className={result ? "text-accent-purple" : "text-muted"} />
          </div>
          <p className="text-sm font-medium text-foreground mt-3">Experienced</p>
          <p className={cn("text-xs mt-0.5", result ? "text-accent-blue-light" : "text-muted")}>{result ? "Badge Earned" : "Not yet earned"}</p>
        </div>
      </div>

      <div className="qk-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award size={16} className="text-accent-blue-light" /> Leaderboard
          </h3>
          <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
            {leaderboardTabs.map((t) => (
              <button
                key={t}
                onClick={() => setLbTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  lbTab === t ? "bg-accent-blue text-white" : "text-muted hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto qk-scrollbar">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border-subtle">
                <th className="py-2 font-medium">Rank</th>
                <th className="py-2 font-medium">Member</th>
                <th className="py-2 font-medium">Score</th>
                <th className="py-2 font-medium">Time</th>
                <th className="py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 8).map((entry) => (
                <tr
                  key={entry.userId + entry.lessonId}
                  className={cn(
                    "border-b border-border-subtle/60",
                    entry.userId === session.user.id && "bg-accent-blue/10"
                  )}
                >
                  <td className="py-2.5">
                    {entry.rank <= 3 ? <Crown size={14} className="text-accent-gold inline mr-1" /> : null}
                    {entry.rank}
                  </td>
                  <td className="py-2.5 flex items-center gap-2">
                    <img src={entry.userAvatarUrl} className="w-6 h-6 rounded-full" alt="" />
                    <span className={cn(entry.userId === session.user.id ? "text-accent-blue-light font-medium" : "text-foreground")}>
                      {entry.userId === session.user.id ? `${entry.userName} (You)` : entry.userName}
                    </span>
                  </td>
                  <td className="py-2.5 font-semibold text-foreground">{entry.score.toLocaleString()}</td>
                  <td className="py-2.5 text-muted">{entry.time}</td>
                  <td className="py-2.5 text-muted">{entry.date}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No results yet for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QuestStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="qk-card p-2.5 text-center">
      <p className="text-base font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted mt-0.5">{label}</p>
    </div>
  );
}
