"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Tag as TagIcon,
  Upload,
  Send,
  Save,
  Library,
  CheckCircle2,
  X,
  LayoutDashboard,
  AlertTriangle,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { createClient } from "@/lib/supabase/client";
import { getMyHostChurches } from "@/services/supabase/churches";
import { getPublishedLessonsByChurch } from "@/services/supabase/lessons";
import { buildThumbnailPath, uploadLessonThumbnail } from "@/services/supabase/lessonThumbnails";
import { submitLessonDraft } from "./actions";
import { publishLesson, updateLessonThumbnail } from "@/app/lessons/[lessonId]/actions";
import { Button, LinkButton } from "@/components/ui/Button";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { LoadingState, ErrorState } from "@/components/ui/AsyncState";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { ThumbnailUploadField } from "@/components/lessons/ThumbnailUploadField";
import { PublishedChurch, PublishedLesson } from "@/types";

const lessonTypes = ["sermon", "bible-study", "youth", "devotional", "series"] as const;

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true; // empty is fine, field is optional
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function ExperienceBuilderForm() {
  const router = useRouter();
  const { session, ready } = useSession();

  const [churches, setChurches] = useState<PublishedChurch[]>([]);
  const [churchesLoading, setChurchesLoading] = useState(true);
  const [churchesError, setChurchesError] = useState("");
  const [churchId, setChurchId] = useState("");

  const [recentLessons, setRecentLessons] = useState<PublishedLesson[]>([]);

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [date, setDate] = useState("");
  const [lessonType, setLessonType] = useState<(typeof lessonTypes)[number]>("sermon");
  const [ministryCategory, setMinistryCategory] = useState("");
  const [notesUrl, setNotesUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [slidesUrl, setSlidesUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [primaryScripture, setPrimaryScripture] = useState("");
  const [supportingScriptures, setSupportingScriptures] = useState("");
  const [questUrl, setQuestUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; slug: string; title: string; churchSlug: string } | null>(
    null
  );

  // Thumbnail is only uploaded after the lesson draft exists (its id is part of the storage
  // path), so until then this is all local, unsaved state.
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [thumbnailAlt, setThumbnailAlt] = useState("");
  const [thumbnailUniqueId] = useState(() => crypto.randomUUID());
  const [thumbnailStatus, setThumbnailStatus] = useState<"idle" | "uploading" | "failed" | "done">("idle");

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [published, setPublished] = useState(false);

  const isHost = ready && session.isLoggedIn && session.accountType === "host";

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;
    (async () => {
      setChurchesLoading(true);
      try {
        const supabase = createClient();
        const myChurches = await getMyHostChurches(supabase);
        if (cancelled) return;
        setChurches(myChurches);
        setChurchId((current) => current || myChurches[0]?.id || "");
        setChurchesError("");
      } catch {
        if (!cancelled) setChurchesError("Could not load your churches.");
      } finally {
        if (!cancelled) setChurchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHost]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!churchId) {
        if (!cancelled) setRecentLessons([]);
        return;
      }
      try {
        const supabase = createClient();
        const lessons = await getPublishedLessonsByChurch(supabase, churchId);
        if (!cancelled) setRecentLessons(lessons.slice(0, 3));
      } catch {
        if (!cancelled) setRecentLessons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [churchId]);

  if (!ready) return null;

  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to build a lesson experience.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  if (session.accountType !== "host") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Only Church Host accounts can build a lesson experience.</p>
        <LinkButton href="/dashboard">Go to Dashboard</LinkButton>
      </div>
    );
  }

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      setTags((t) => Array.from(new Set([...t, tagInput.trim()])));
      setTagInput("");
    }
  }

  function handleSelectThumbnail(file: File) {
    setThumbnailFile(file);
    setThumbnailPreviewUrl(URL.createObjectURL(file));
    setThumbnailStatus("idle");
  }

  function handleRemoveThumbnail() {
    setThumbnailFile(null);
    setThumbnailPreviewUrl(null);
    setThumbnailStatus("idle");
  }

  async function performThumbnailUpload(lessonId: string, forChurchId: string, lessonSlug: string, churchSlug: string) {
    if (!thumbnailFile) return;
    setThumbnailStatus("uploading");
    const supabase = createClient();
    const path = buildThumbnailPath(forChurchId, lessonId, thumbnailUniqueId, thumbnailFile.name);

    const uploadResult = await uploadLessonThumbnail(supabase, path, thumbnailFile);
    if (uploadResult.error) {
      setThumbnailStatus("failed");
      return;
    }

    const updateResult = await updateLessonThumbnail({
      lessonId,
      lessonSlug,
      churchSlug,
      featuredImageUrl: uploadResult.publicUrl,
      featuredImageAlt: thumbnailAlt || null,
    });
    if (updateResult.error) {
      setThumbnailStatus("failed");
      return;
    }
    setThumbnailStatus("done");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // reentrancy guard against a fast double-click/double-submit
    setError("");

    if (!title || !topic || !shortDescription || !speakerName || !date || !ministryCategory || !primaryScripture) {
      setError("Please complete all required fields marked with *.");
      return;
    }
    if (!churchId) {
      setError("Complete your church setup before building a lesson experience.");
      return;
    }
    if (!notesUrl && !videoUrl && !audioUrl && !slidesUrl && !documentUrl && !transcript) {
      setError("At least one content source (notes, video, audio, slides, document, or transcript) is required.");
      return;
    }
    const invalidField = [
      ["Sermon Notes Link", notesUrl],
      ["Lesson Video Link", videoUrl],
      ["Audio Link", audioUrl],
      ["Slides Link", slidesUrl],
      ["Document Link", documentUrl],
    ].find(([, value]) => !isValidUrl(value));
    if (invalidField) {
      setError(`${invalidField[0]} doesn't look like a valid web address.`);
      return;
    }

    setSubmitting(true);
    const result = await submitLessonDraft({
      churchId,
      title,
      topic,
      shortDescription,
      ministryCategory,
      speakerName,
      date,
      lessonType,
      primaryScripture,
      supportingScriptures: supportingScriptures.split(",").map((s) => s.trim()).filter(Boolean),
      tags,
      questUrl: questUrl || undefined,
      media: [
        { mediaType: "notes", url: notesUrl },
        { mediaType: "video", url: videoUrl },
        { mediaType: "audio", url: audioUrl },
        { mediaType: "slides", url: slidesUrl },
        { mediaType: "document", url: documentUrl },
        { mediaType: "transcript", content: transcript },
      ],
    });

    if (result.error) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    if (result.lesson) {
      setCreated(result.lesson);
      // The draft itself is safely created at this point regardless of what happens next --
      // a thumbnail upload failure below must never look like the whole submission failed.
      if (thumbnailFile) {
        await performThumbnailUpload(result.lesson.id, churchId, result.lesson.slug, result.lesson.churchSlug);
      }
      router.refresh();
    }
    setSubmitting(false);
  }

  async function handlePublishFromSuccess() {
    if (!created) return;
    setPublishing(true);
    setPublishError("");
    const result = await publishLesson(created.id, created.slug, created.churchSlug);
    setPublishing(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setPublished(true);
    router.refresh();
  }

  if (created) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={26} className="text-accent-blue-light" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {published ? "Lesson Published" : "Lesson Saved as Draft"}
        </h1>
        <p className="text-muted text-sm mb-4">
          {published ? (
            <>&ldquo;{created.title}&rdquo; is now live in the Lessons Library and your church archive.</>
          ) : (
            <>
              Your lesson experience has been saved as a draft. Preview &ldquo;{created.title}&rdquo;, then publish
              when you&apos;re ready.
            </>
          )}
        </p>

        {thumbnailStatus === "uploading" && (
          <p className="text-xs text-muted bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 mb-4 inline-block">
            Uploading thumbnail...
          </p>
        )}
        {thumbnailStatus === "failed" && (
          <div className="text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 mb-4 text-left">
            <p className="text-red-300 flex items-center gap-1.5">
              <AlertTriangle size={14} /> Your lesson was saved, but the thumbnail image failed to upload.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => performThumbnailUpload(created.id, churchId, created.slug, created.churchSlug)}
            >
              Retry Thumbnail Upload
            </Button>
          </div>
        )}
        {thumbnailStatus === "done" && (
          <p className="text-xs text-accent-blue-light mb-4">Thumbnail uploaded.</p>
        )}

        {publishError && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 inline-block">
            {publishError}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href={`/lessons/${created.slug}`} variant="secondary">
            Preview Draft
          </LinkButton>
          {!published && (
            <Button onClick={handlePublishFromSuccess} disabled={publishing}>
              {publishing ? "Publishing..." : "Publish Experience"}
            </Button>
          )}
          <LinkButton href="/host-dashboard" variant={published ? "primary" : "secondary"}>
            <LayoutDashboard size={16} /> Return to Host Dashboard
          </LinkButton>
        </div>
        <button
          onClick={() => {
            setCreated(null);
            setPublished(false);
            setPublishError("");
            setTitle("");
            setTopic("");
            setShortDescription("");
            setThumbnailFile(null);
            setThumbnailPreviewUrl(null);
            setThumbnailAlt("");
            setThumbnailStatus("idle");
          }}
          className="text-sm text-muted hover:text-foreground underline mt-6"
        >
          Build another experience
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground">Build a Lesson Experience</h1>
      <p className="text-muted text-sm mt-1 mb-5">
        Turn a sermon, Bible class, or teaching into a study, Quest, and story journey.
      </p>

      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId="new" currentStage="not-started" linkBase={() => "/experience-builder"} />
      </div>

      {churchesLoading ? (
        <LoadingState label="Loading your churches..." />
      ) : churchesError ? (
        <ErrorState message={churchesError} />
      ) : churches.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">
          <p className="mb-4">You don&apos;t manage a church yet. Complete church setup to start building lesson experiences.</p>
          <LinkButton href="/onboarding/church">Complete Church Setup</LinkButton>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Lesson Setup</h2>
            <p className="text-xs text-muted -mt-3">Provide the key details about this lesson.</p>

            <ThumbnailUploadField
              previewUrl={thumbnailPreviewUrl}
              alt={thumbnailAlt}
              onSelectFile={handleSelectThumbnail}
              onRemove={handleRemoveThumbnail}
              onAltChange={setThumbnailAlt}
              disabled={submitting}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Lesson Title" required>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Walking in Kingdom Authority" className="qk-input" />
              </Field>
              <Field label="Main Topic" required>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Faith, Kingdom Living, Prayer" className="qk-input" />
              </Field>
            </div>

            <Field label="Short Description" required>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value.slice(0, 250))}
                placeholder="A brief summary of the main idea and key takeaways (max 250 characters)"
                rows={2}
                className="qk-input resize-none"
              />
            </Field>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Speaker / Teacher" required>
                <input value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} placeholder="e.g., Pastor Daniel Okoro" className="qk-input" />
              </Field>
              <Field label="Church" required>
                <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="qk-input">
                  {churches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Lesson Date" required>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="qk-input" />
              </Field>
              <Field label="Lesson Type" required>
                <select value={lessonType} onChange={(e) => setLessonType(e.target.value as typeof lessonType)} className="qk-input">
                  {lessonTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("-", " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Ministry Category" required>
              <input
                value={ministryCategory}
                onChange={(e) => setMinistryCategory(e.target.value)}
                placeholder="e.g., Sunday Morning Service, Youth, Midweek Study"
                className="qk-input"
              />
            </Field>

            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Sermon Notes Link">
                <input value={notesUrl} onChange={(e) => setNotesUrl(e.target.value)} placeholder="https://yourchurch.com/notes" className="qk-input" />
              </Field>
              <Field label="Lesson Video Link">
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className="qk-input" />
              </Field>
              <Field label="Audio Link">
                <input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://yourchurch.com/audio" className="qk-input" />
              </Field>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Document Link">
                <input value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="https://yourchurch.com/handout.pdf" className="qk-input" />
              </Field>
              <Field label="Slides Link">
                <input value={slidesUrl} onChange={(e) => setSlidesUrl(e.target.value)} placeholder="https://yourchurch.com/slides or a Canva link" className="qk-input" />
              </Field>
            </div>

            <Field label="Transcript">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste a transcript of the lesson, if you have one"
                rows={3}
                className="qk-input resize-none"
              />
            </Field>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Upload Notes (PDF, DOCX, TXT)">
                <label className="qk-input flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer py-6 text-muted">
                  <Upload size={18} />
                  <span className="text-xs">Drag &amp; drop your file here or click to browse</span>
                  <input type="file" className="hidden" />
                </label>
              </Field>
              <div className="grid gap-4">
                <Field label="Primary Scripture" required>
                  <input value={primaryScripture} onChange={(e) => setPrimaryScripture(e.target.value)} placeholder="e.g., Matthew 6:33" className="qk-input" />
                </Field>
                <Field label="Supporting Scriptures">
                  <input
                    value={supportingScriptures}
                    onChange={(e) => setSupportingScriptures(e.target.value)}
                    placeholder="e.g., Philippians 4:6-7, Isaiah 40:31 (comma separated)"
                    className="qk-input"
                  />
                </Field>
              </div>
            </div>

            <Field label="Quest Launch URL (Optional)">
              <input value={questUrl} onChange={(e) => setQuestUrl(e.target.value)} placeholder="https://questforthekingdom.com/quest/your-quest-id" className="qk-input" />
            </Field>

            <Field label="Tags">
              <div className="qk-input flex flex-wrap items-center gap-1.5 py-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 bg-accent-blue/15 text-accent-blue-light text-xs px-2 py-1 rounded-full">
                    {t}
                    <button type="button" onClick={() => setTags((ts) => ts.filter((x) => x !== t))}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder="Add tags and press Enter..."
                  className="flex-1 min-w-[140px] bg-transparent outline-none text-sm placeholder:text-muted"
                />
                <TagIcon size={14} className="text-muted shrink-0" />
              </div>
              <p className="text-[11px] text-muted mt-1">Add keywords to help others find your lesson</p>
            </Field>

            {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="secondary" disabled={submitting}>
                <Save size={16} /> Save Draft
              </Button>
              <Button type="submit" disabled={submitting}>
                <Send size={16} /> {submitting ? "Saving..." : "Save Experience Draft"}
              </Button>
              <Link
                href={`/churches/${churches.find((c) => c.id === churchId)?.slug ?? ""}`}
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground px-4 py-2.5"
              >
                <Library size={16} /> View Church Archive
              </Link>
            </div>
          </form>

          <div className="space-y-5">
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-accent-blue-light" /> AI Processing Preview
              </h3>
              <p className="text-xs text-muted mb-3">When you submit, our AI will help prepare your lesson.</p>
              <ul className="space-y-3">
                {[
                  ["Topic Detection", "Identifying main themes and key topics"],
                  ["Scripture Extraction", "Finding and organizing key scriptures"],
                  ["Summary Generation", "Creating a concise lesson summary"],
                  ["25 Question Generation", "Building study questions for engagement"],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0">
                      <Sparkles size={13} className="text-accent-purple" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{t}</p>
                      <p className="text-[11px] text-muted">{d}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted mt-3">AI helps, you lead. Review and refine before publishing.</p>
            </div>

            <div className="qk-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Recent Church Archive</h3>
                <Link
                  href={`/churches/${churches.find((c) => c.id === churchId)?.slug ?? ""}`}
                  className="text-xs text-accent-blue-light hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {recentLessons.map((l) => (
                  <div key={l.id} className="flex items-center gap-2.5">
                    <LessonThumbnail
                      src={l.featuredImageUrl}
                      alt={l.featuredImageAlt}
                      aspect="square"
                      rounded="rounded-lg"
                      className="w-10 h-10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{l.title}</p>
                      <p className="text-[11px] text-muted">{l.date}</p>
                    </div>
                    <span className="text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full">Published</span>
                  </div>
                ))}
                {recentLessons.length === 0 && <p className="text-xs text-muted">No published lessons yet for this church.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">
        {label} {required && <span className="text-accent-blue-light">*</span>}
      </span>
      {children}
    </label>
  );
}
