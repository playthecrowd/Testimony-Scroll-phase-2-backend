"use client";

import { use, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Play, Headphones, Box } from "lucide-react";
import { getLesson } from "@/services/lessonService";
import { getChurchById } from "@/data/churches";
import { getSpeakerById } from "@/data/speakers";
import { getStudyQuestionsForLesson } from "@/data/questions";
import { useSession } from "@/context/SessionContext";
import { getJourney, startJourney, updateChecklistItem, completeStudied } from "@/services/journeyService";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { Journey } from "@/types";

const tabs = ["Overview", "Study Notes", "Watch or Listen", "Study Questions", "Contributors"] as const;

export default function StudiedStagePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = getLesson(lessonId);
  const { session, ready } = useSession();
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");

  useEffect(() => {
    if (ready && session.isLoggedIn && lesson) {
      let j = getJourney(session.user.id, lesson.id);
      if (!j) j = startJourney(session.user.id, lesson.id);
      setJourney(j);
    }
  }, [ready, session, lesson]);

  if (!lesson) return notFound();
  if (!ready) return null;
  if (!session.isLoggedIn) {
    router.push("/login");
    return null;
  }
  if (!journey) return null;

  const church = getChurchById(lesson.churchId);
  const speaker = getSpeakerById(lesson.speakerId);
  const questions = getStudyQuestionsForLesson(lesson.id);
  const checklist = journey.checklist;
  const allComplete = checklist.notesStudied && checklist.videoWatched && checklist.questionsAnswered;
  const completedCount = Object.values(checklist).filter(Boolean).length + (journey.stage !== "captured" ? 0 : 0);
  const progress = journey.stage === "studied" ? 100 : Math.min(90, Math.round((completedCount / 5) * 100));

  function toggle(key: keyof Journey["checklist"]) {
    const updated = updateChecklistItem(session.user.id, lesson!.id, key, !journey!.checklist[key]);
    setJourney(updated);
  }

  function finishStage() {
    const updated = completeStudied(session.user.id, lesson!.id);
    setJourney(updated);
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId={lesson.id} currentStage={journey.stage} />
      </div>

      <Link href="/my-journey" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-3">
        <ArrowLeft size={15} /> Back to My Journey
      </Link>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{lesson.title}</h1>
              <p className="text-muted text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {church && <span>{church.name}</span>}
                {speaker && <span>{speaker.name}</span>}
                <span>{formatDate(lesson.date)}</span>
                <span>Scripture: {lesson.primaryScripture}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 mb-5 border-b border-border-subtle overflow-x-auto qk-scrollbar">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                  tab === t ? "border-accent-blue-light text-foreground" : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Overview" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Message Overview</h3>
              <p className="text-sm text-muted leading-relaxed">{lesson.aboutText}</p>
            </div>
          )}

          {tab === "Study Notes" && (
            <div className="qk-card p-5">
              <p className="text-sm text-muted leading-relaxed">{lesson.aboutText}</p>
              <button
                onClick={() => toggle("notesStudied")}
                className="mt-4 flex items-center gap-2 text-sm text-accent-blue-light"
              >
                {checklist.notesStudied ? <CheckCircle2 size={16} /> : <Circle size={16} />} Mark Notes as Studied
              </button>
            </div>
          )}

          {tab === "Watch or Listen" && (
            <div className="qk-card p-5 space-y-4">
              {lesson.videoUrl && (
                <div>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-surface-2 mb-2">
                    <img src={lesson.featuredImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                        <Play size={22} className="text-white ml-1" fill="white" />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => toggle("videoWatched")} className="flex items-center gap-2 text-sm text-accent-blue-light">
                    {checklist.videoWatched ? <CheckCircle2 size={16} /> : <Circle size={16} />} Mark Video as Watched
                  </button>
                </div>
              )}
              {lesson.audioUrl && (
                <button onClick={() => toggle("audioListened")} className="flex items-center gap-2 text-sm text-accent-blue-light">
                  {checklist.audioListened ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <Headphones size={14} /> Mark Audio as Listened
                </button>
              )}
            </div>
          )}

          {tab === "Study Questions" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Study Questions ({questions.length} Total)</h3>
              <ol className="space-y-2.5 mb-4">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-2.5 text-sm text-muted">
                    <span className="text-accent-blue-light font-medium">{i + 1}.</span> {q.question}
                  </li>
                ))}
              </ol>
              <button onClick={() => toggle("questionsAnswered")} className="flex items-center gap-2 text-sm text-accent-blue-light">
                {checklist.questionsAnswered ? <CheckCircle2 size={16} /> : <Circle size={16} />} Mark Questions Complete
              </button>
            </div>
          )}

          {tab === "Contributors" && (
            <div className="qk-card p-5">
              <p className="text-sm text-muted">{lesson.contributorsCount} members have studied this lesson so far.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Complete Your Study</h3>
            <p className="text-xs text-muted mb-3">Mark each item as complete to finish the Studied stage.</p>
            <div className="space-y-2.5">
              <ChecklistRow label="Mark Notes as Studied" done={checklist.notesStudied} onClick={() => toggle("notesStudied")} />
              <ChecklistRow label="Mark Video as Watched" done={checklist.videoWatched} onClick={() => toggle("videoWatched")} />
              <ChecklistRow label="Mark Questions Complete" done={checklist.questionsAnswered} onClick={() => toggle("questionsAnswered")} />
            </div>
            <Button onClick={finishStage} disabled={!allComplete} className="w-full justify-center mt-4">
              <Box size={16} /> {journey.stage === "studied" ? "Studied Complete" : "Mark Lesson Complete"}
            </Button>
            {journey.stage === "studied" && (
              <p className="text-xs text-accent-blue-light text-center mt-2">Great job, keep going on your journey!</p>
            )}
          </div>

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Your Progress</h3>
            <p className="text-3xl font-bold text-accent-blue-light">{progress}%</p>
            <div className="h-1.5 rounded-full bg-surface-2 mt-2 overflow-hidden">
              <div className="h-full bg-accent-blue" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {journey.stage === "studied" && (
            <div className="qk-card p-4 qk-glow-blue">
              <p className="text-sm font-semibold text-foreground mb-1">Join the 3D Quest</p>
              <p className="text-xs text-muted mb-3">Experience this lesson in our 3D environment.</p>
              <Button onClick={() => router.push(`/journey/${lesson.id}/experienced`)} className="w-full justify-center">
                <Box size={16} /> Join the 3D Quest
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ChecklistRow({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 text-left">
      {done ? <CheckCircle2 size={17} className="text-accent-blue-light shrink-0" /> : <Circle size={17} className="text-muted shrink-0" />}
      <span className={cn("text-sm", done ? "text-foreground" : "text-muted")}>{label}</span>
    </button>
  );
}
