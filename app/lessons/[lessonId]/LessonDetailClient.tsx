"use client";

import { useEffect, useState } from "react";
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
  Pencil,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getJourneyForLesson } from "@/services/supabase/journeys";
import { useAuthGuard } from "@/components/ui/useAuthGuard";
import { Button, LinkButton } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { PublishedLesson, LessonMedia } from "@/types";
import { publishLesson } from "./actions";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { ThumbnailEditorPanel } from "@/components/lessons/ThumbnailEditorPanel";
import { getMyHostChurches } from "@/services/supabase/churches";
import { createClient } from "@/lib/supabase/client";

const tabs = ["Overview", "Notes", "Video", "Slides", "Hosts", "Questions"] as const;

function isValidUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Supports youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, and already-embed URLs.
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function MediaSection({
  icon: Icon,
  buttonLabel,
  media,
}: {
  icon: React.ElementType;
  buttonLabel: string;
  media: LessonMedia;
}) {
  const hasUrl = !!media.url;
  const urlValid = isValidUrl(media.url);
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Icon size={15} className="text-accent-blue-light shrink-0" /> {media.title || buttonLabel}
        </p>
        {hasUrl && urlValid && (
          <a
            href={media.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle hover:border-accent-blue-light text-foreground shrink-0"
          >
            <Icon size={13} /> {buttonLabel}
          </a>
        )}
        {hasUrl && !urlValid && <span className="text-xs text-red-300 shrink-0">Invalid link</span>}
      </div>
      {media.content && <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{media.content}</p>}
    </div>
  );
}

export function LessonDetailClient({ lesson }: { lesson: PublishedLesson }) {
  const router = useRouter();
  const { session, ready } = useSession();
  const { guard, Modal } = useAuthGuard();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [selectedHostOverride, setSelectedHostOverride] = useState<string | null>(null);
  const [hasJourney, setHasJourney] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishedNow, setPublishedNow] = useState(false);
  const [canManageThumbnail, setCanManageThumbnail] = useState(false);

  useEffect(() => {
    if (!ready || !session.isLoggedIn || session.accountType !== "host") return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const myChurches = await getMyHostChurches(supabase);
        if (!cancelled) setCanManageThumbnail(myChurches.some((c) => c.id === lesson.church.id));
      } catch {
        if (!cancelled) setCanManageThumbnail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session, lesson.church.id]);

  // Read-only: this never creates a journey. The Studied page itself is the one place a journey
  // record is created (getOrCreateJourney's upsert on first load) -- this effect only decides
  // whether to show "Start Your Journey" or "Continue Your Journey".
  useEffect(() => {
    if (!ready || !session.isLoggedIn) {
      setHasJourney(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const journey = await getJourneyForLesson(supabase, lesson.id);
        if (!cancelled) setHasJourney(!!journey);
      } catch {
        if (!cancelled) setHasJourney(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session, lesson.id]);

  const selectedHost = selectedHostOverride ?? lesson.hosts[0]?.id ?? null;
  // Real, per-lesson questions as of Phase 3 (docs/PHASE3_AUDIT.md) -- previously this read from
  // data/questions.ts, a static mock catalog disconnected from real lessons. Listing them here is
  // as far as Phase 3 goes; required-response/completion tracking is Phase 4's job.
  const questions = lesson.questions;
  const activeHost = lesson.hosts.find((h) => h.id === selectedHost) ?? lesson.hosts[0];

  const notesMedia = lesson.media.filter((m) => m.mediaType === "notes");
  const audioMedia = lesson.media.filter((m) => m.mediaType === "audio");
  const documentMedia = lesson.media.filter((m) => m.mediaType === "document");
  const transcriptMedia = lesson.media.filter((m) => m.mediaType === "transcript");
  const notesTabCount = notesMedia.length + audioMedia.length + documentMedia.length + transcriptMedia.length;
  const videoMedia = lesson.media.find((m) => m.mediaType === "video");
  const slidesMedia = lesson.media.find((m) => m.mediaType === "slides");
  const videoEmbedUrl = videoMedia?.url ? getYouTubeEmbedUrl(videoMedia.url) : null;

  function handleStart() {
    // The journey record itself is created by the Studied page on load (getOrCreateJourney),
    // not here -- this just navigates there once the auth guard passes.
    guard(() => {
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
            {publishing ? "Publishing..." : "Publish Experience"}
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
            <LessonThumbnail
              src={lesson.featuredImageUrl}
              alt={lesson.featuredImageAlt}
              aspect="square"
              className="sm:aspect-auto sm:h-full"
              sizes="220px"
              priority
            >
              {lesson.questLevel && (
                <span className="absolute top-2 right-2 text-[11px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                  Level {lesson.questLevel}
                </span>
              )}
            </LessonThumbnail>
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
                {notesTabCount > 0 && <TabButton icon={FileText} label="Open Notes" onClick={() => setTab("Notes")} />}
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
            <div className="qk-card p-5 space-y-5">
              <h3 className="text-sm font-semibold text-foreground -mb-1">Lesson Materials</h3>
              {notesMedia.map((m) => (
                <MediaSection key={m.id} icon={FileText} buttonLabel="Open Notes" media={m} />
              ))}
              {audioMedia.map((m) => (
                <MediaSection key={m.id} icon={Headphones} buttonLabel="Listen to Audio" media={m} />
              ))}
              {documentMedia.map((m) => (
                <MediaSection key={m.id} icon={FileText} buttonLabel="Open Document" media={m} />
              ))}
              {transcriptMedia.map((m) => (
                <MediaSection key={m.id} icon={FileText} buttonLabel="Open Transcript" media={m} />
              ))}
              {notesTabCount === 0 && (
                <p className="text-sm text-muted">No notes, audio, documents, or transcript were captured for this lesson.</p>
              )}
            </div>
          )}

          {tab === "Video" && (
            <div className="qk-card p-5">
              {!videoMedia ? (
                <p className="text-sm text-muted">No video was captured for this lesson.</p>
              ) : !isValidUrl(videoMedia.url) ? (
                <p className="text-sm text-red-300">This lesson&apos;s video link looks invalid.</p>
              ) : videoEmbedUrl ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-surface-2">
                  <iframe
                    src={videoEmbedUrl}
                    title="Lesson video"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a
                  href={videoMedia.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group aspect-video rounded-lg overflow-hidden bg-surface-2 flex items-center justify-center relative"
                >
                  {lesson.featuredImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lesson.featuredImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                  )}
                  <div className="relative w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center group-hover:bg-black/70 transition-colors">
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                  <span className="absolute bottom-3 right-3 text-xs bg-black/60 text-white px-2.5 py-1 rounded">Watch Video</span>
                </a>
              )}
            </div>
          )}

          {tab === "Slides" && (
            <div className="qk-card p-5">
              {!slidesMedia ? (
                <p className="text-sm text-muted">No slides were captured for this lesson.</p>
              ) : !isValidUrl(slidesMedia.url) ? (
                <p className="text-sm text-red-300">This lesson&apos;s slides link looks invalid.</p>
              ) : (
                <a
                  href={slidesMedia.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-video rounded-lg bg-surface-2 flex items-center justify-center gap-2 text-foreground text-sm border border-transparent hover:border-accent-blue-light transition-colors"
                >
                  <Presentation size={22} className="text-accent-blue-light" /> View Slides
                </a>
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
          {canManageThumbnail && (
            <LinkButton href={`/experience-builder/${lesson.slug}/edit`} variant="secondary" className="w-full justify-center">
              <Pencil size={16} /> Edit Experience
            </LinkButton>
          )}
          {canManageThumbnail && <ThumbnailEditorPanel lesson={lesson} churchId={lesson.church.id} />}

          <div className="qk-card p-4">
            {hasJourney ? (
              // Same destination as Start -- the Studied route is shared for every lesson and
              // is where progress actually lives, regardless of which stage is current.
              <LinkButton href={`/journey/${lesson.id}/studied`} className="w-full justify-center">
                <Box size={16} /> Continue Your Journey
              </LinkButton>
            ) : (
              <Button onClick={handleStart} className="w-full justify-center">
                <Box size={16} /> Start Your Journey
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

          {lesson.experiences.length > 0 && (
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Connected Experiences</h3>
              <div className="space-y-2.5">
                {lesson.experiences.map((le) => (
                  <div key={le.id} className="flex items-center gap-2.5">
                    <LessonThumbnail
                      src={le.experience.previewImageUrl}
                      alt=""
                      aspect="square"
                      rounded="rounded-lg"
                      className="w-9 h-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{le.experience.name}</p>
                      {le.relationshipNote && <p className="text-[11px] text-muted truncate">{le.relationshipNote}</p>}
                    </div>
                  </div>
                ))}
              </div>
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
