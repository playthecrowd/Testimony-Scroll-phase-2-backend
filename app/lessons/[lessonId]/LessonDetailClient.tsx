"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { getStudyQuestionsForLesson } from "@/data/questions";
import { useSession } from "@/context/SessionContext";
import { startJourney, getJourney } from "@/services/journeyService";
import { useAuthGuard } from "@/components/ui/useAuthGuard";
import { Button, LinkButton } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { PublishedLesson, LessonMediaType } from "@/types";
import { publishLesson } from "./actions";

const tabs = ["Overview", "Notes", "Video", "Slides", "Hosts", "Questions"] as const;

const mediaIcon: Record<LessonMediaType, React.ElementType> = {
  notes: FileText,
  video: Play,
  audio: Headphones,
  slides: Presentation,
  document: FileText,
  transcript: FileText,
};

export function LessonDetailClient({ lesson }: { lesson: PublishedLesson }) {
  const router = useRouter();
  const { session, ready } = useSession();
  const { guard, Modal } = useAuthGuard();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [selectedHostOverride, setSelectedHostOverride] = useState<string | null>(null);
  const [, force] = useState(0);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishedNow, setPublishedNow] = useState(false);

  const selectedHost = selectedHostOverride ?? lesson.hosts[0]?.id ?? null;
  const questions = getStudyQuestionsForLesson(lesson.id);
  const journey = ready && session.isLoggedIn ? getJourney(session.user.id, lesson.id) : undefined;
  const activeHost = lesson.hosts.find((h) => h.id === selectedHost) ?? lesson.hosts[0];

  const notesLikeMedia = lesson.media.filter((m) =>
    (["notes", "audio", "document", "transcript"] as LessonMediaType[]).includes(m.mediaType)
  );
  const videoMedia = lesson.media.find((m) => m.mediaType === "video");
  const slidesMedia = lesson.media.find((m) => m.mediaType === "slides");

  function handleStart() {
    guard(() => {
      startJourney(session.user.id, lesson.id);
      force((v) => v + 1);
      router.push(`/journey/${lesson.id}/studied`);
    });
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError("");
    const result = await publishLesson(lesson.id, lesson.slug, lesson.church.slug);
    setPublishing(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setPublishedNow(true);
    router.refresh();
  }

  const isDraft = lesson.status === "draft" && !publishedNow;

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      {Modal}
      <Link href="/lessons" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Lessons
      </Link>

      {isDraft && (
        <div className="qk-card p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3 border-accent-gold/40">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">This lesson is a draft</p>
            <p className="text-xs text-muted">
              Only you can see this preview. Publish it to add it to the Lessons Library and your church archive.
            </p>
          </div>
          {publishError && <p className="text-xs text-red-300">{publishError}</p>}
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish Lesson"}
          </Button>
        </div>
      )}
      {publishedNow && (
        <div className="qk-card p-4 mb-5 border-accent-blue-light/40">
          <p className="text-sm font-semibold text-foreground">
            Published! This lesson is now live in the Lessons Library and church archive.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="grid sm:grid-cols-[220px_1fr] gap-5 mb-6">
            <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-xl overflow-hidden bg-surface-2">
              {lesson.featuredImageUrl && (
                <img src={lesson.featuredImageUrl} className="w-full h-full object-cover" alt="" />
              )}
              {lesson.questLevel && (
                <span className="absolute top-2 right-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                  Level {lesson.questLevel}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-accent-blue-light font-medium mb-1">Lesson</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{lesson.title}</h1>
              {lesson.shortDescription && <p className="text-muted text-sm mt-1.5">{lesson.shortDescription}</p>}
              {lesson.speaker && (
                <div className="flex items-center gap-2 mt-3">
                  {lesson.speaker.avatarUrl && (
                    <img src={lesson.speaker.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                  )}
                  <div className="text-sm">
                    <span className="text-foreground font-medium">{lesson.speaker.name}</span>
                    <span className="text-muted"> · {lesson.church.name}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
                {lesson.primaryScripture && (
                  <span>
                    Scripture: <span className="text-foreground">{lesson.primaryScripture}</span>
                  </span>
                )}
                {lesson.topic && (
                  <span>
                    Topic: <span className="text-foreground">{lesson.topic}</span>
                  </span>
                )}
                {lesson.subject && (
                  <span>
                    Subject: <span className="text-foreground">{lesson.subject}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {notesLikeMedia.length > 0 && <TabButton icon={FileText} label="Open Notes" onClick={() => setTab("Notes")} />}
                {videoMedia && <TabButton icon={Play} label="Watch Video" onClick={() => setTab("Video")} />}
                {slidesMedia && <TabButton icon={Presentation} label="View Slides" onClick={() => setTab("Slides")} />}
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
                {t === "Hosts" && <span className="text-[10px] bg-surface-2 px-1.5 rounded-full">{lesson.hosts.length}</span>}
              </button>
            ))}
          </div>

          {tab === "Overview" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">About This Lesson</h3>
              {lesson.aboutText && <p className="text-sm text-muted leading-relaxed mb-4">{lesson.aboutText}</p>}
              {questions.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-foreground mb-2">What You&apos;ll Learn</h3>
                  <ul className="space-y-2">
                    {questions.slice(0, 4).map((q) => (
                      <li key={q.id} className="flex items-start gap-2 text-sm text-muted">
                        <CheckCircle2 size={14} className="text-accent-blue-light mt-0.5 shrink-0" /> {q.question}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === "Notes" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Lesson Materials</h3>
              {notesLikeMedia.length > 0 ? (
                <ul className="space-y-3">
                  {notesLikeMedia.map((m) => {
                    const Icon = mediaIcon[m.mediaType];
                    return (
                      <li key={m.id} className="flex items-start gap-2.5 text-sm">
                        <Icon size={15} className="text-accent-blue-light mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-foreground font-medium capitalize">{m.title || m.mediaType}</p>
                          {m.url && (
                            <a href={m.url} target="_blank" rel="noreferrer" className="text-accent-blue-light hover:underline break-all">
                              {m.url}
                            </a>
                          )}
                          {m.content && <p className="text-muted mt-1 whitespace-pre-wrap">{m.content}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">No notes, audio, documents, or transcript were captured for this lesson.</p>
              )}
            </div>
          )}

          {tab === "Video" && (
            <div className="qk-card p-5">
              {videoMedia ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-surface-2 flex items-center justify-center relative">
                  {lesson.featuredImageUrl && (
                    <img src={lesson.featuredImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                  )}
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
              {slidesMedia ? (
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
                {lesson.hosts.map((hs) => {
                  if (!hs.church) return null;
                  const active = selectedHost === hs.id;
                  return (
                    <button
                      key={hs.id}
                      onClick={() => setSelectedHostOverride(hs.id)}
                      className={cn(
                        "qk-card p-3.5 text-left flex items-center gap-3 transition-colors",
                        active && "border-accent-blue-light qk-glow-blue"
                      )}
                    >
                      {hs.church.logoUrl && <img src={hs.church.logoUrl} className="w-10 h-10 rounded-full" alt="" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{hs.church.name}</p>
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
                {lesson.hosts.length === 0 && <p className="text-sm text-muted">No churches are hosting this lesson yet.</p>}
              </div>
            </div>
          )}

          {tab === "Questions" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Study Questions ({questions.length})</h3>
              {questions.length > 0 ? (
                <ol className="space-y-2.5">
                  {questions.map((q, i) => (
                    <li key={q.id} className="flex items-start gap-2.5 text-sm text-muted">
                      <span className="text-accent-blue-light font-medium">{i + 1}.</span> {q.question}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Study questions for this lesson are coming soon.</p>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="qk-card p-4">
            {journey ? (
              <LinkButton
                href={`/journey/${lesson.id}/${journey.stage === "captured" ? "studied" : journey.stage}`}
                className="w-full justify-center"
              >
                <Box size={16} /> Continue Journey
              </LinkButton>
            ) : (
              <Button onClick={handleStart} className="w-full justify-center">
                <Box size={16} /> Start This Journey
              </Button>
            )}
            <p className="text-xs text-muted text-center mt-2">Step into a live hosted experience with a community.</p>
          </div>

          {activeHost?.church && (
            <div className="qk-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Your Host Selection</h3>
                <button onClick={() => setTab("Hosts")} className="text-xs text-accent-blue-light hover:underline">
                  Change
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                {activeHost.church.logoUrl && <img src={activeHost.church.logoUrl} className="w-10 h-10 rounded-full" alt="" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{activeHost.church.name}</p>
                </div>
              </div>
            </div>
          )}

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Quick Details</h3>
            <div className="space-y-2 text-xs">
              <DetailRow label="Duration" value={lesson.durationLabel || "—"} />
              <DetailRow label="Date" value={lesson.date ? formatDate(lesson.date) : "—"} />
              <DetailRow label="Ministry" value={lesson.ministryCategory || "—"} />
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
