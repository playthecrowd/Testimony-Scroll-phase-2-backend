"use client";

import { useState, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  FileText,
  Presentation,
  Headphones,
  Box,
  CheckCircle2,
  ChevronRight,
  Radio,
  Users2,
} from "lucide-react";
import { getLesson } from "@/services/lessonService";
import { getChurchById } from "@/data/churches";
import { getSpeakerById } from "@/data/speakers";
import { getHostsByIds } from "@/data/hosts";
import { getStudyQuestionsForLesson } from "@/data/questions";
import { useSession } from "@/context/SessionContext";
import { startJourney, getJourney } from "@/services/journeyService";
import { useAuthGuard } from "@/components/ui/useAuthGuard";
import { Button, LinkButton } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

const tabs = ["Overview", "Notes", "Video", "Slides", "Hosts", "Questions"] as const;

export default function LessonDetailPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = getLesson(lessonId);
  const router = useRouter();
  const { session, ready } = useSession();
  const { guard, Modal } = useAuthGuard();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (lesson?.hostSessions[0]) setSelectedHost(lesson.hostSessions[0].hostId);
  }, [lesson]);

  if (!lesson) return notFound();

  const church = getChurchById(lesson.churchId);
  const speaker = getSpeakerById(lesson.speakerId);
  const hosts = getHostsByIds(lesson.hostSessions.map((h) => h.hostId));
  const questions = getStudyQuestionsForLesson(lesson.id);
  const journey = ready && session.isLoggedIn ? getJourney(session.user.id, lesson.id) : undefined;
  const activeHost = hosts.find((h) => h.id === selectedHost) ?? hosts[0];

  function handleStart() {
    guard(() => {
      startJourney(session.user.id, lesson!.id);
      force((v) => v + 1);
      router.push(`/journey/${lesson!.id}/studied`);
    });
  }

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.roadToEaster} opacity={0.3} />
      {Modal}
      <Link href="/lessons" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Lessons
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="grid sm:grid-cols-[220px_1fr] gap-5 mb-6">
            <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-xl overflow-hidden bg-surface-2">
              <img src={lesson.featuredImageUrl} className="w-full h-full object-cover" alt="" />
              {lesson.questLevel && (
                <span className="absolute top-2 right-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                  Level {lesson.questLevel}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-accent-blue-light font-medium mb-1">Lesson</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{lesson.title}</h1>
              <p className="text-muted text-sm mt-1.5">{lesson.shortDescription}</p>
              {speaker && (
                <div className="flex items-center gap-2 mt-3">
                  <img src={speaker.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                  <div className="text-sm">
                    <span className="text-foreground font-medium">{speaker.name}</span>
                    {church && <span className="text-muted"> · {church.name}</span>}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
                <span>Scripture: <span className="text-foreground">{lesson.primaryScripture}</span></span>
                <span>Topic: <span className="text-foreground">{lesson.topic}</span></span>
                <span>Subject: <span className="text-foreground">{lesson.subject}</span></span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {lesson.notesUrl && <TabButton icon={FileText} label="Open Notes" onClick={() => setTab("Notes")} />}
                {lesson.videoUrl && <TabButton icon={Play} label="Watch Video" onClick={() => setTab("Video")} />}
                {lesson.slidesUrl && <TabButton icon={Presentation} label="View Slides" onClick={() => setTab("Slides")} />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 mb-5 border-b border-border-subtle overflow-x-auto qk-scrollbar">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                  tab === t ? "border-accent-blue-light text-foreground" : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {t}
                {t === "Questions" && <span className="text-[10px] bg-surface-2 px-1.5 rounded-full">{questions.length}</span>}
                {t === "Hosts" && <span className="text-[10px] bg-surface-2 px-1.5 rounded-full">{hosts.length}</span>}
              </button>
            ))}
          </div>

          {tab === "Overview" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">About This Lesson</h3>
              <p className="text-sm text-muted leading-relaxed mb-4">{lesson.aboutText}</p>
              <h3 className="text-sm font-semibold text-foreground mb-2">What You&apos;ll Learn</h3>
              <ul className="space-y-2">
                {questions.slice(0, 4).map((q) => (
                  <li key={q.id} className="flex items-start gap-2 text-sm text-muted">
                    <CheckCircle2 size={14} className="text-accent-blue-light mt-0.5 shrink-0" /> {q.question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "Notes" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Sermon Notes</h3>
              {lesson.notesUrl ? (
                <p className="text-sm text-muted">
                  Notes for this lesson are available at{" "}
                  <span className="text-accent-blue-light">{lesson.notesUrl}</span>. {lesson.aboutText}
                </p>
              ) : (
                <p className="text-sm text-muted">No notes were captured for this lesson.</p>
              )}
            </div>
          )}

          {tab === "Video" && (
            <div className="qk-card p-5">
              {lesson.videoUrl ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-surface-2 flex items-center justify-center relative">
                  <img src={lesson.featuredImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                  <div className="relative w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No video was captured for this lesson.</p>
              )}
            </div>
          )}

          {tab === "Slides" && (
            <div className="qk-card p-5">
              {lesson.slidesUrl ? (
                <div className="aspect-video rounded-lg bg-surface-2 flex items-center justify-center text-muted text-sm">
                  <Presentation size={28} className="mr-2" /> Slide deck placeholder
                </div>
              ) : (
                <p className="text-sm text-muted">No slides were captured for this lesson.</p>
              )}
            </div>
          )}

          {tab === "Hosts" && (
            <div className="qk-card p-5">
              <p className="text-xs text-muted mb-4">Choose a host to join their live experience.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {lesson.hostSessions.map((hs) => {
                  const host = hosts.find((h) => h.id === hs.hostId);
                  if (!host) return null;
                  const active = selectedHost === host.id;
                  return (
                    <button
                      key={host.id}
                      onClick={() => setSelectedHost(host.id)}
                      className={cn(
                        "qk-card p-3.5 text-left flex items-center gap-3 transition-colors",
                        active && "border-accent-blue-light qk-glow-blue"
                      )}
                    >
                      <img src={host.logoUrl} className="w-10 h-10 rounded-full" alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{host.churchName}</p>
                        <p className="text-xs text-muted truncate">{host.facilitatorName}</p>
                        <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                          {hs.status === "live" ? (
                            <>
                              <Radio size={10} className="text-accent-blue-light" /> Live Now
                            </>
                          ) : (
                            "Scheduled"
                          )}
                          <span className="ml-1 flex items-center gap-0.5">
                            <Users2 size={10} /> {hs.participantCount.toLocaleString()} joined
                          </span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "Questions" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Study Questions ({questions.length})</h3>
              <ol className="space-y-2.5">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-2.5 text-sm text-muted">
                    <span className="text-accent-blue-light font-medium">{i + 1}.</span> {q.question}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="qk-card p-4">
            {journey ? (
              <LinkButton href={`/journey/${lesson.id}/${journey.stage === "captured" ? "studied" : journey.stage}`} className="w-full justify-center">
                <Box size={16} /> Continue Journey
              </LinkButton>
            ) : (
              <Button onClick={handleStart} className="w-full justify-center">
                <Box size={16} /> Start This Journey
              </Button>
            )}
            <p className="text-xs text-muted text-center mt-2">Step into a live hosted experience with a community.</p>
          </div>

          {activeHost && (
            <div className="qk-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Your Host Selection</h3>
                <button onClick={() => setTab("Hosts")} className="text-xs text-accent-blue-light hover:underline">
                  Change
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <img src={activeHost.logoUrl} className="w-10 h-10 rounded-full" alt="" />
                <div>
                  <p className="text-sm font-medium text-foreground">{activeHost.churchName}</p>
                  <p className="text-xs text-muted">{activeHost.facilitatorName}</p>
                </div>
              </div>
            </div>
          )}

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Quick Details</h3>
            <div className="space-y-2 text-xs">
              <DetailRow label="Duration" value={lesson.durationLabel || "—"} />
              <DetailRow label="Date" value={formatDate(lesson.date)} />
              <DetailRow label="Ministry" value={lesson.ministryCategory} />
              <DetailRow label="XP Reward" value={lesson.xpReward ? `${lesson.xpReward} XP` : "—"} />
              <DetailRow label="Contributors" value={lesson.contributorsCount} />
            </div>
          </div>

          {lesson.supportingScriptures.length > 0 && (
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Supporting Scriptures</h3>
              <ul className="space-y-1 text-xs text-muted">
                {lesson.supportingScriptures.map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <ChevronRight size={12} className="text-accent-blue-light" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TabButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle hover:border-accent-blue-light text-foreground">
      <Icon size={13} /> {label}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
