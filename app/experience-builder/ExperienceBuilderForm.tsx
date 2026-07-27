"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Tag as TagIcon,
  Send,
  Library,
  CheckCircle2,
  X,
  LayoutDashboard,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { createClient } from "@/lib/supabase/client";
import { getMyHostChurches } from "@/services/supabase/churches";
import { getPublishedLessonsByChurch, addLessonMediaItem } from "@/services/supabase/lessons";
import { getExperiences, replaceLessonExperiences } from "@/services/supabase/experiences";
import { replaceLessonQuestions } from "@/services/supabase/questions";
import { buildThumbnailPath, uploadLessonThumbnail } from "@/services/supabase/lessonThumbnails";
import { buildDocumentPath, uploadLessonDocument } from "@/services/supabase/lessonDocuments";
import { submitLessonDraft } from "./actions";
import { publishLesson, updateLessonThumbnail } from "@/app/lessons/[lessonId]/actions";
import { Button, LinkButton } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/AsyncState";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { ThumbnailUploadField } from "@/components/lessons/ThumbnailUploadField";
import { DocumentUploadField } from "@/components/lessons/DocumentUploadField";
import { MediaItemsEditor, MediaItemFormRow } from "@/components/lessons/MediaItemsEditor";
import { QuestionsEditor, QuestionDraft, validateQuestionDrafts, toQuestionInputs } from "@/components/lessons/QuestionsEditor";
import { ExperienceConnectionSelector, ExperienceSelection } from "@/components/lessons/ExperienceConnectionSelector";
import { isValidMediaUrl } from "@/lib/lessonForm";
import { Field } from "@/components/ui/FormField";
import { PublishedChurch, PublishedLesson, Experience } from "@/types";

const lessonTypes = ["sermon", "bible-study", "youth", "devotional", "series"] as const;

const STEPS = ["Source Materials", "Lesson Information", "Questions", "Experience Connection", "Review & Publish"] as const;

function emptyMediaRow(): MediaItemFormRow {
  return { key: crypto.randomUUID(), id: null, mediaType: "notes", url: "", content: "", title: "", sortOrder: 0 };
}

export function ExperienceBuilderForm() {
  const router = useRouter();
  const { session, ready } = useSession();

  const [step, setStep] = useState(0);

  const [churches, setChurches] = useState<PublishedChurch[]>([]);
  const [churchesLoading, setChurchesLoading] = useState(true);
  const [churchesError, setChurchesError] = useState("");
  const [churchId, setChurchId] = useState("");

  const [recentLessons, setRecentLessons] = useState<PublishedLesson[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);

  // Step 1 -- Source Materials
  const [media, setMedia] = useState<MediaItemFormRow[]>([emptyMediaRow()]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Step 2 -- Lesson Information (required-first; optional fields grouped below them)
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [date, setDate] = useState("");
  const [lessonType, setLessonType] = useState<(typeof lessonTypes)[number]>("sermon");
  const [ministryCategory, setMinistryCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [primaryScripture, setPrimaryScripture] = useState("");
  const [supportingScriptures, setSupportingScriptures] = useState("");
  const [subject, setSubject] = useState("");
  const [durationLabel, setDurationLabel] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [thumbnailAlt, setThumbnailAlt] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [thumbnailUniqueId] = useState(() => crypto.randomUUID());
  const [thumbnailStatus, setThumbnailStatus] = useState<"idle" | "uploading" | "failed" | "done">("idle");

  // Step 3 -- Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // Step 4 -- Experience Connection
  const [experienceSelections, setExperienceSelections] = useState<ExperienceSelection[]>([]);
  const [questUrl, setQuestUrl] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; slug: string; title: string; churchSlug: string } | null>(null);

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

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const catalog = await getExperiences(supabase);
        if (!cancelled) setExperiences(catalog);
      } catch {
        if (!cancelled) setExperiences([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHost]);

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

  const providedMedia = media.filter((m) => (m.url && m.url.trim()) || (m.content && m.content.trim()));
  const hasContentSource = providedMedia.length > 0 || !!documentFile;

  // Handles both the deferred thumbnail file upload (can only happen once the lesson has a real
  // id) and the Background Image URL, which -- unlike the thumbnail -- has no file to upload, but
  // is applied in this same follow-up call rather than a second one so there's only ever one
  // post-creation write to reconcile, never two competing updates.
  async function performThumbnailUpload(lessonId: string, forChurchId: string, lessonSlug: string, churchSlug: string) {
    const trimmedBackground = backgroundImageUrl.trim() || null;
    if (!thumbnailFile && !trimmedBackground) return;

    let featuredImageUrl: string | null = null;
    let featuredImageAlt: string | null = null;
    const supabase = createClient();

    if (thumbnailFile) {
      setThumbnailStatus("uploading");
      const path = buildThumbnailPath(forChurchId, lessonId, thumbnailUniqueId, thumbnailFile.name);
      const uploadResult = await uploadLessonThumbnail(supabase, path, thumbnailFile);
      if (!uploadResult.ok) {
        setThumbnailStatus("failed");
        return;
      }
      featuredImageUrl = uploadResult.publicUrl;
      featuredImageAlt = thumbnailAlt || null;
    }

    const updateResult = await updateLessonThumbnail({
      lessonId,
      lessonSlug,
      churchSlug,
      featuredImageUrl,
      featuredImageAlt,
      backgroundImageUrl: trimmedBackground,
    });
    if (updateResult.error) {
      if (thumbnailFile) setThumbnailStatus("failed");
      return;
    }
    if (thumbnailFile) setThumbnailStatus("done");
    router.refresh();
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep > 0 && !hasContentSource) {
      return "At least one content source (an uploaded file, a link, or a transcript) is required.";
    }
    if (targetStep > 1) {
      if (!title || !topic || !shortDescription || !speakerName || !date || !ministryCategory || !primaryScripture) {
        return "Please complete all required fields marked with * before continuing.";
      }
      const invalidField = providedMedia.find((m) => m.mediaType !== "transcript" && m.url && !isValidMediaUrl(m.url));
      if (invalidField) return "One of your media links doesn't look like a valid web address.";
      if (!isValidMediaUrl(backgroundImageUrl)) return "Background Image URL doesn't look like a valid web address.";
    }
    return null;
  }

  function goToStep(target: number) {
    if (target > step) {
      // Validate every threshold up to (and including) the destination step, not just the next
      // one -- otherwise jumping straight to a later step via the step pills would skip
      // validation for steps in between.
      const validationError = validateStep(target);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError("");
    setStep(target);
  }

  async function handleSubmit() {
    if (submitting) return; // reentrancy guard against a fast double-click/double-submit
    setError("");

    // Passing 2 triggers both threshold checks inside validateStep (content source + lesson
    // info) regardless of which step the wizard is actually showing right now.
    const stepError = validateStep(2);
    if (stepError) {
      setError(stepError);
      return;
    }
    if (!churchId) {
      setError("Complete your church setup before building a lesson experience.");
      return;
    }
    // Checked before the lesson row itself is created (unlike media/experience links below, which
    // stay best-effort after save) -- a host choosing a correct answer and having it silently fail
    // to persist is worse than being blocked here on an obviously-incomplete question.
    const questionErrors = validateQuestionDrafts(questions);
    if (questionErrors.length > 0) {
      setError(questionErrors[0]);
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
      media: providedMedia.map((m) => ({ mediaType: m.mediaType, url: m.url, content: m.content, title: m.title })),
    });

    if (result.error) {
      setSubmitting(false);
      setError(result.error);
      return;
    }
    if (result.lesson) {
      setCreated(result.lesson);
      const supabase = createClient();

      // Everything below the draft's core fields is best-effort follow-up: the lesson itself is
      // already safely saved at this point, so none of these failing should look like the whole
      // submission failed.
      if (questions.some((q) => q.question.trim())) {
        try {
          await replaceLessonQuestions(supabase, result.lesson.id, toQuestionInputs(questions));
        } catch (err) {
          console.error("[ExperienceBuilderForm] Failed to save questions:", err);
        }
      }
      if (experienceSelections.length > 0) {
        try {
          await replaceLessonExperiences(
            supabase,
            result.lesson.id,
            experienceSelections.map((s) => ({ experienceId: s.experienceId, relationshipNote: s.relationshipNote || null }))
          );
        } catch (err) {
          console.error("[ExperienceBuilderForm] Failed to save experience connections:", err);
        }
      }
      if (documentFile) {
        try {
          const path = buildDocumentPath(churchId, result.lesson.id, thumbnailUniqueId, documentFile.name);
          const uploadResult = await uploadLessonDocument(supabase, path, documentFile);
          if (uploadResult.ok) {
            await addLessonMediaItem(supabase, result.lesson.id, "document", uploadResult.publicUrl);
          }
        } catch (err) {
          console.error("[ExperienceBuilderForm] Failed to upload document:", err);
        }
      }
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
        <h1 className="text-2xl font-bold text-foreground mb-2">{published ? "Lesson Published" : "Lesson Saved as Draft"}</h1>
        <p className="text-muted text-sm mb-4">
          {published ? (
            <>&ldquo;{created.title}&rdquo; is now live in the Lessons Library and your church archive.</>
          ) : (
            <>
              Your lesson experience has been saved as a draft. Preview &ldquo;{created.title}&rdquo;, then publish when
              you&apos;re ready.
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
        {thumbnailStatus === "done" && <p className="text-xs text-accent-blue-light mb-4">Thumbnail uploaded.</p>}

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
            setStep(0);
            setMedia([emptyMediaRow()]);
            setDocumentFile(null);
            setTitle("");
            setTopic("");
            setShortDescription("");
            setQuestions([]);
            setExperienceSelections([]);
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
      <p className="text-muted text-sm mt-1 mb-5">Turn a sermon, Bible class, or teaching into a study, Quest, and story journey.</p>

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
          <div className="qk-card p-5 space-y-4 min-w-0">
            <div className="flex items-center gap-1.5 overflow-x-auto qk-scrollbar -mx-1 px-1 pb-1">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => goToStep(i)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors ${
                    i === step
                      ? "bg-accent-blue text-white"
                      : i < step
                        ? "bg-accent-blue/15 text-accent-blue-light"
                        : "bg-surface-2 text-muted"
                  }`}
                >
                  {i + 1}. {label}
                </button>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Step 1: Add Your Source Materials</h2>
                <p className="text-xs text-muted -mt-2">
                  Upload a file, paste links (video, audio, notes, slides, document), or paste a transcript. At least one is
                  required.
                </p>

                <Field label="Upload a Document (PDF, DOCX, TXT)">
                  <DocumentUploadField
                    file={documentFile}
                    onSelectFile={setDocumentFile}
                    onRemove={() => setDocumentFile(null)}
                    disabled={submitting}
                  />
                </Field>

                <div>
                  <span className="block text-xs font-medium text-muted mb-1.5">Links, Notes &amp; Transcript</span>
                  <MediaItemsEditor items={media} onChange={setMedia} disabled={submitting} />
                </div>

                <p className={`text-xs ${hasContentSource ? "text-accent-blue-light" : "text-accent-gold"}`}>
                  {hasContentSource
                    ? "At least one content source has been added."
                    : "At least one content source is required before you can publish."}
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Step 2: Lesson Information</h2>
                <p className="text-xs text-muted -mt-2">Required fields first -- optional details are further down.</p>

                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Lesson Title" required>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Walking in Kingdom Authority" className="qk-input" />
                  </Field>
                  <Field label="Speaker / Teacher" required>
                    <input value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} placeholder="e.g., Pastor Daniel Okoro" className="qk-input" />
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
                  <Field label="Church" required>
                    <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="qk-input">
                      {churches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date Taught" required>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="qk-input" />
                  </Field>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Lesson Type" required>
                    <select value={lessonType} onChange={(e) => setLessonType(e.target.value as typeof lessonType)} className="qk-input">
                      {lessonTypes.map((t) => (
                        <option key={t} value={t}>
                          {t.replace("-", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ministry Category" required>
                    <input
                      value={ministryCategory}
                      onChange={(e) => setMinistryCategory(e.target.value)}
                      placeholder="e.g., Sunday Morning Service, Youth, Midweek Study"
                      className="qk-input"
                    />
                  </Field>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Main Topic" required>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Faith, Kingdom Living, Prayer" className="qk-input" />
                  </Field>
                  <Field label="Primary Scripture" required>
                    <input value={primaryScripture} onChange={(e) => setPrimaryScripture(e.target.value)} placeholder="e.g., Matthew 6:33" className="qk-input" />
                  </Field>
                </div>

                <div className="border-t border-border-subtle pt-4 mt-2">
                  <p className="text-xs font-semibold text-muted mb-3">Optional details</p>
                  <div className="space-y-4">
                    <Field label="Supporting Scriptures">
                      <input
                        value={supportingScriptures}
                        onChange={(e) => setSupportingScriptures(e.target.value)}
                        placeholder="e.g., Philippians 4:6-7, Isaiah 40:31 (comma separated)"
                        className="qk-input"
                      />
                    </Field>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Field label="Subject">
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="qk-input" />
                      </Field>
                      <Field label="Duration">
                        <input value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="e.g., 32 min" className="qk-input" />
                      </Field>
                    </div>
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
                    </Field>
                    <ThumbnailUploadField
                      previewUrl={thumbnailPreviewUrl}
                      alt={thumbnailAlt}
                      onSelectFile={handleSelectThumbnail}
                      onRemove={handleRemoveThumbnail}
                      onAltChange={setThumbnailAlt}
                      disabled={submitting}
                    />
                    <div>
                      <Field label="Background Image URL">
                        <input
                          value={backgroundImageUrl}
                          onChange={(e) => setBackgroundImageUrl(e.target.value)}
                          placeholder="https://..."
                          disabled={submitting}
                          className="qk-input"
                        />
                      </Field>
                      <p className="text-[11px] text-muted mt-1.5">Large lesson detail page background -- separate from the thumbnail above.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Step 3: Questions</h2>
                <p className="text-xs text-muted -mt-2">Optional. Add questions to help members reflect on this lesson.</p>
                <QuestionsEditor questions={questions} onChange={setQuestions} disabled={submitting} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Step 4: Experience Connection</h2>
                <p className="text-xs text-muted -mt-2">
                  Connect this lesson to one or more existing Quest for the Kingdom experiences, and explain why they relate.
                </p>
                <ExperienceConnectionSelector
                  experiences={experiences}
                  selections={experienceSelections}
                  onChange={setExperienceSelections}
                  disabled={submitting}
                />
                <Field label="Manual Quest Launch URL (optional fallback)">
                  <input value={questUrl} onChange={(e) => setQuestUrl(e.target.value)} placeholder="https://questforthekingdom.com/quest/your-quest-id" className="qk-input" />
                </Field>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Step 5: Review &amp; Publish</h2>
                <div className="qk-card p-4 space-y-2 text-sm">
                  <ReviewRow label="Title" value={title || "—"} />
                  <ReviewRow label="Speaker" value={speakerName || "—"} />
                  <ReviewRow label="Church" value={churches.find((c) => c.id === churchId)?.name ?? "—"} />
                  <ReviewRow label="Date Taught" value={date || "—"} />
                  <ReviewRow label="Content sources" value={`${providedMedia.length + (documentFile ? 1 : 0)} added`} />
                  <ReviewRow label="Questions" value={`${questions.filter((q) => q.question.trim()).length} added`} />
                  <ReviewRow label="Connected experiences" value={`${experienceSelections.length} selected`} />
                </div>
                <p className="text-xs text-muted">
                  Saving creates this lesson as a draft, visible only to your church&apos;s hosts/admins. You can preview it,
                  then publish when you&apos;re ready.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {step > 0 && (
                <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                  <ArrowLeft size={16} /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => goToStep(step + 1)} disabled={submitting}>
                  Next <ArrowRight size={16} />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={submitting}>
                  <Send size={16} /> {submitting ? "Saving..." : "Save Experience Draft"}
                </Button>
              )}
              <Link
                href={`/churches/${churches.find((c) => c.id === churchId)?.slug ?? ""}`}
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground px-2 py-2.5 ml-auto"
              >
                <Library size={16} /> View Church Archive
              </Link>
            </div>
          </div>

          <div className="space-y-5">
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Lightbulb size={15} className="text-accent-blue-light" /> Getting Better Results
              </h3>
              <p className="text-xs text-muted mb-2">A few things that make a lesson easier to study later:</p>
              <ul className="space-y-2 text-xs text-muted list-disc list-inside">
                <li>A transcript or full notes give members more to read alongside the video.</li>
                <li>A YouTube link lets members watch without leaving the study flow.</li>
                <li>Clear scripture references make the lesson easier to find and connect to a testimony.</li>
                <li>A short, specific description helps members decide if this lesson is for them.</li>
              </ul>
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
                    <LessonThumbnail src={l.featuredImageUrl} alt={l.featuredImageAlt} aspect="square" rounded="rounded-lg" className="w-10 h-10 shrink-0" />
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}
