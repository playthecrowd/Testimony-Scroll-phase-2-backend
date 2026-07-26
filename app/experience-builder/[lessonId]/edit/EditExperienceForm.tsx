"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Send, X, Eye, EyeOff, CheckCircle2, AlertTriangle, Tag as TagIcon, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLessonBySlug } from "@/services/supabase/lessons";
import { buildThumbnailPath, uploadLessonThumbnail, deleteLessonThumbnailByUrl } from "@/services/supabase/lessonThumbnails";
import { getExperiences, replaceLessonExperiences } from "@/services/supabase/experiences";
import { replaceLessonQuestions } from "@/services/supabase/questions";
import { validateRequiredLessonFields, isValidMediaUrl } from "@/lib/lessonForm";
import { LessonEditAction, LessonStatus } from "@/lib/lessonStatus";
import { updateLessonExperience } from "./actions";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/FormField";
import { ThumbnailUploadField } from "@/components/lessons/ThumbnailUploadField";
import { MediaItemsEditor, MediaItemFormRow } from "@/components/lessons/MediaItemsEditor";
import { QuestionsEditor, QuestionDraft, validateQuestionDrafts, toQuestionInputs, questionsToDrafts } from "@/components/lessons/QuestionsEditor";
import { ExperienceConnectionSelector, ExperienceSelection } from "@/components/lessons/ExperienceConnectionSelector";
import { PublishedLesson, Experience } from "@/types";

const lessonTypes = ["sermon", "bible-study", "youth", "devotional", "series"] as const;

function mediaRowsFromLesson(lesson: PublishedLesson): MediaItemFormRow[] {
  return lesson.media.map((m, i) => ({
    key: m.id,
    id: m.id,
    mediaType: m.mediaType,
    url: m.url ?? "",
    content: m.content ?? "",
    title: m.title ?? "",
    sortOrder: i,
  }));
}

export function EditExperienceForm({ lesson: initialLesson }: { lesson: PublishedLesson }) {
  const router = useRouter();

  const [lesson, setLesson] = useState(initialLesson);
  const [currentStatus, setCurrentStatus] = useState<LessonStatus>(initialLesson.status);

  const [title, setTitle] = useState(initialLesson.title);
  const [topic, setTopic] = useState(initialLesson.topic ?? "");
  const [shortDescription, setShortDescription] = useState(initialLesson.shortDescription ?? "");
  const [aboutText, setAboutText] = useState(initialLesson.aboutText ?? "");
  const [subject, setSubject] = useState(initialLesson.subject ?? "");
  const [ministryCategory, setMinistryCategory] = useState(initialLesson.ministryCategory ?? "");
  const [speakerName, setSpeakerName] = useState(initialLesson.speaker?.name ?? "");
  const [date, setDate] = useState(initialLesson.date ?? "");
  const [durationLabel, setDurationLabel] = useState(initialLesson.durationLabel ?? "");
  const [lessonType, setLessonType] = useState<(typeof lessonTypes)[number]>(
    (initialLesson.lessonType as (typeof lessonTypes)[number]) || "sermon"
  );
  const [primaryScripture, setPrimaryScripture] = useState(initialLesson.primaryScripture ?? "");
  const [supportingScriptures, setSupportingScriptures] = useState(initialLesson.supportingScriptures.join(", "));
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initialLesson.tags);
  const [questUrl, setQuestUrl] = useState(initialLesson.questUrl ?? "");
  const [questLevel, setQuestLevel] = useState(initialLesson.questLevel != null ? String(initialLesson.questLevel) : "");
  const [xpReward, setXpReward] = useState(initialLesson.xpReward != null ? String(initialLesson.xpReward) : "");

  const [mediaItems, setMediaItems] = useState<MediaItemFormRow[]>(() => mediaRowsFromLesson(initialLesson));
  const existingMediaIdsRef = useRef(initialLesson.media.map((m) => m.id));

  const [questions, setQuestions] = useState<QuestionDraft[]>(() => questionsToDrafts(initialLesson.questions));
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [experienceSelections, setExperienceSelections] = useState<ExperienceSelection[]>(() =>
    initialLesson.experiences.map((e) => ({ experienceId: e.experience.id, relationshipNote: e.relationshipNote ?? "" }))
  );

  useEffect(() => {
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
  }, []);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(initialLesson.featuredImageUrl);
  const [thumbnailAlt, setThumbnailAlt] = useState(initialLesson.featuredImageAlt ?? "");
  const [removeExistingThumbnail, setRemoveExistingThumbnail] = useState(false);
  const [thumbnailUniqueId] = useState(() => crypto.randomUUID());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const skipDirtyCheck = useRef(true);

  useEffect(() => {
    if (skipDirtyCheck.current) {
      skipDirtyCheck.current = false;
      return;
    }
    setDirty(true);
    setSuccessMessage("");
  }, [
    title,
    topic,
    shortDescription,
    aboutText,
    subject,
    ministryCategory,
    speakerName,
    date,
    durationLabel,
    lessonType,
    primaryScripture,
    supportingScriptures,
    tags,
    questUrl,
    questLevel,
    xpReward,
    mediaItems,
    thumbnailFile,
    thumbnailAlt,
    removeExistingThumbnail,
    questions,
    experienceSelections,
  ]);

  // Covers tab close / refresh / typed-URL navigation. In-app link clicks (sidebar, top nav) are
  // not intercepted -- the App Router has no public navigation-blocking API as of Next 16, so
  // that's a known gap; the Cancel button below is the reliable in-app path and does confirm.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

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
    setRemoveExistingThumbnail(false);
  }

  function handleRemoveThumbnail() {
    if (thumbnailFile) {
      // Just clears the pending, unsaved replacement -- reverts the preview to what's actually
      // still saved, no confirmation needed since nothing saved has changed yet.
      setThumbnailFile(null);
      setThumbnailPreviewUrl(removeExistingThumbnail ? null : lesson.featuredImageUrl);
      return;
    }
    if (lesson.featuredImageUrl && !removeExistingThumbnail) {
      if (!window.confirm("Remove the current thumbnail? The lesson will use the default fallback image until you add a new one.")) {
        return;
      }
      setRemoveExistingThumbnail(true);
      setThumbnailPreviewUrl(null);
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    router.push("/experience-builder");
  }

  async function handleSave(action: LessonEditAction) {
    if (submitting) return; // reentrancy guard against a fast double-click/double-submit
    setError("");
    setSuccessMessage("");

    const fieldError = validateRequiredLessonFields({
      title,
      topic,
      shortDescription,
      speakerName,
      date,
      ministryCategory,
      primaryScripture,
    });
    if (fieldError) {
      setError(fieldError);
      return;
    }

    // This form only ever renders for a host-editable, church-owned lesson (the page-level gate
    // in page.tsx already excludes campaign lessons, which have no church) -- this is a defensive
    // type guard, not an expected runtime path.
    if (!lesson.church) {
      setError("This lesson has no owning church and cannot be edited here.");
      return;
    }
    const church = lesson.church;

    const preparedMedia = mediaItems.map((item) => ({
      id: item.id,
      mediaType: item.mediaType,
      url: item.url,
      content: item.content,
      title: item.title,
      sortOrder: item.sortOrder,
    }));
    const provided = preparedMedia.filter((m) => (m.url && m.url.trim()) || (m.content && m.content.trim()));
    if (provided.length === 0) {
      setError("At least one content source (notes, video, audio, slides, document, or transcript) is required.");
      return;
    }
    const badMedia = provided.find((m) => m.mediaType !== "transcript" && m.url && !isValidMediaUrl(m.url));
    if (badMedia) {
      setError("One of your media links doesn't look like a valid web address.");
      return;
    }

    // Checked before the lesson row itself is saved (unlike media/experience links below, which
    // stay best-effort after save) -- a host choosing a correct answer and having it silently fail
    // to persist is worse than being blocked here on an obviously-incomplete question.
    const questionErrors = validateQuestionDrafts(questions);
    if (questionErrors.length > 0) {
      setError(questionErrors[0]);
      return;
    }

    if (action === "unpublish") {
      const confirmed = window.confirm(
        "Unpublish this lesson? It will no longer appear in the public Lessons Library or church archive until you publish it again."
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    const supabase = createClient();

    let resolvedImageUrl: string | null = null;
    let resolvedImageAlt: string | null = null;
    let keepExisting = true;

    if (thumbnailFile) {
      const path = buildThumbnailPath(church.id, lesson.id, thumbnailUniqueId, thumbnailFile.name);
      const uploadResult = await uploadLessonThumbnail(supabase, path, thumbnailFile);
      if (!uploadResult.ok) {
        // The original thumbnail is untouched -- we haven't written anything to the database yet.
        setSubmitting(false);
        setError(`Thumbnail upload failed: ${uploadResult.error}. Your other changes were not saved -- please try again.`);
        return;
      }
      resolvedImageUrl = uploadResult.publicUrl;
      resolvedImageAlt = thumbnailAlt || null;
      keepExisting = false;
    } else if (removeExistingThumbnail) {
      resolvedImageUrl = null;
      resolvedImageAlt = null;
      keepExisting = false;
    }

    const result = await updateLessonExperience({
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
      churchId: church.id,
      churchSlug: church.slug,
      currentStatus,
      action,
      title,
      topic,
      shortDescription,
      aboutText,
      subject,
      ministryCategory,
      speakerName,
      date,
      durationLabel,
      lessonType,
      primaryScripture,
      supportingScriptures: supportingScriptures.split(",").map((s) => s.trim()).filter(Boolean),
      tags,
      questUrl,
      questLevel: questLevel.trim() ? Number(questLevel) : null,
      xpReward: xpReward.trim() ? Number(xpReward) : null,
      keepExistingThumbnail: keepExisting,
      featuredImageUrl: resolvedImageUrl,
      featuredImageAlt: resolvedImageAlt,
      media: provided,
      existingMediaIds: existingMediaIdsRef.current,
    });

    if (result.error) {
      setSubmitting(false);
      setError(result.error);
      return;
    }

    // Only now that the database update is confirmed is it safe to delete the previous storage
    // object -- never before this point.
    if (!keepExisting && lesson.featuredImageUrl) {
      await deleteLessonThumbnailByUrl(supabase, lesson.featuredImageUrl);
    }

    // Best-effort, same as the create wizard: the lesson's core fields are already confirmed
    // saved above, so a failure here must not look like the whole save failed.
    try {
      await replaceLessonQuestions(supabase, lesson.id, toQuestionInputs(questions));
    } catch (err) {
      console.error("[EditExperienceForm] Failed to save questions:", err);
    }
    try {
      await replaceLessonExperiences(
        supabase,
        lesson.id,
        experienceSelections.map((s) => ({ experienceId: s.experienceId, relationshipNote: s.relationshipNote || null }))
      );
    } catch (err) {
      console.error("[EditExperienceForm] Failed to save experience connections:", err);
    }

    // Re-fetch the saved lesson and reset every field from it. This is what keeps a second save
    // in the same session correct (new media rows now have real ids instead of null, so they're
    // updated rather than re-inserted as duplicates) rather than trying to hand-correlate
    // inserted rows back to form state.
    const fresh = await getLessonBySlug(supabase, result.lesson!.slug);
    if (fresh) {
      skipDirtyCheck.current = true;
      setLesson(fresh);
      setCurrentStatus(fresh.status);
      setTitle(fresh.title);
      setTopic(fresh.topic ?? "");
      setShortDescription(fresh.shortDescription ?? "");
      setAboutText(fresh.aboutText ?? "");
      setSubject(fresh.subject ?? "");
      setMinistryCategory(fresh.ministryCategory ?? "");
      setSpeakerName(fresh.speaker?.name ?? "");
      setDate(fresh.date ?? "");
      setDurationLabel(fresh.durationLabel ?? "");
      setLessonType((fresh.lessonType as (typeof lessonTypes)[number]) || "sermon");
      setPrimaryScripture(fresh.primaryScripture ?? "");
      setSupportingScriptures(fresh.supportingScriptures.join(", "));
      setTags(fresh.tags);
      setQuestUrl(fresh.questUrl ?? "");
      setQuestLevel(fresh.questLevel != null ? String(fresh.questLevel) : "");
      setXpReward(fresh.xpReward != null ? String(fresh.xpReward) : "");
      setMediaItems(mediaRowsFromLesson(fresh));
      existingMediaIdsRef.current = fresh.media.map((m) => m.id);
      setQuestions(questionsToDrafts(fresh.questions));
      setExperienceSelections(
        fresh.experiences.map((e) => ({ experienceId: e.experience.id, relationshipNote: e.relationshipNote ?? "" }))
      );
      setThumbnailFile(null);
      setThumbnailPreviewUrl(fresh.featuredImageUrl);
      setThumbnailAlt(fresh.featuredImageAlt ?? "");
      setRemoveExistingThumbnail(false);
    }

    setSubmitting(false);
    setDirty(false);
    setSuccessMessage("Lesson changes saved successfully.");
    router.refresh();
  }

  const isDraft = currentStatus === "draft";

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link
        href="/experience-builder"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4"
      >
        <ArrowLeft size={15} /> Back to Experience Builder
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Lesson Experience</h1>
        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
            isDraft ? "bg-accent-gold/15 text-accent-gold" : "bg-accent-blue/15 text-accent-blue-light"
          }`}
        >
          {isDraft ? "Draft" : "Published"}
        </span>
      </div>
      <p className="text-muted text-sm mt-1 mb-5">
        Editing &ldquo;{lesson.title}&rdquo; for {lesson.church?.name ?? "your church"}.
      </p>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="qk-card p-5 space-y-4 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Lesson Setup</h2>
          <p className="text-xs text-muted -mt-3">Update the details of this lesson experience.</p>

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
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="qk-input" />
            </Field>
            <Field label="Main Topic" required>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} className="qk-input" />
            </Field>
          </div>

          <Field label="Short Description" required>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value.slice(0, 250))}
              rows={2}
              className="qk-input resize-none"
            />
          </Field>

          <Field label="About This Lesson">
            <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={3} className="qk-input resize-none" />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Speaker / Teacher" required>
              <input value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} className="qk-input" />
            </Field>
            <Field label="Church">
              <input value={lesson.church?.name ?? ""} disabled className="qk-input opacity-70" />
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

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Ministry Category" required>
              <input value={ministryCategory} onChange={(e) => setMinistryCategory(e.target.value)} className="qk-input" />
            </Field>
            <Field label="Subject">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="qk-input" />
            </Field>
          </div>

          <Field label="Duration">
            <input
              value={durationLabel}
              onChange={(e) => setDurationLabel(e.target.value)}
              placeholder="e.g., 32 min"
              className="qk-input"
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Primary Scripture" required>
              <input value={primaryScripture} onChange={(e) => setPrimaryScripture(e.target.value)} className="qk-input" />
            </Field>
            <Field label="Supporting Scriptures">
              <input
                value={supportingScriptures}
                onChange={(e) => setSupportingScriptures(e.target.value)}
                placeholder="Comma separated"
                className="qk-input"
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Quest Launch URL">
              <input value={questUrl} onChange={(e) => setQuestUrl(e.target.value)} className="qk-input" />
            </Field>
            <Field label="Quest Level">
              <input
                type="number"
                min={0}
                value={questLevel}
                onChange={(e) => setQuestLevel(e.target.value)}
                className="qk-input"
              />
            </Field>
            <Field label="XP Reward">
              <input type="number" min={0} value={xpReward} onChange={(e) => setXpReward(e.target.value)} className="qk-input" />
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

          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">Lesson Media</span>
            <MediaItemsEditor items={mediaItems} onChange={setMediaItems} disabled={submitting} />
          </div>

          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">Questions</span>
            <QuestionsEditor questions={questions} onChange={setQuestions} disabled={submitting} />
          </div>

          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">Experience Connection</span>
            <ExperienceConnectionSelector
              experiences={experiences}
              selections={experienceSelections}
              onChange={setExperienceSelections}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </p>
          )}
          {successMessage && (
            <p className="text-sm text-accent-blue-light bg-accent-blue/10 border border-accent-blue/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" /> {successMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {isDraft ? (
              <>
                <Button variant="secondary" disabled={submitting} onClick={() => handleSave("save-draft")}>
                  <Save size={16} /> {submitting ? "Saving..." : "Save Draft"}
                </Button>
                <Button disabled={submitting} onClick={() => handleSave("publish")}>
                  <Send size={16} /> {submitting ? "Publishing..." : "Publish Lesson"}
                </Button>
              </>
            ) : (
              <>
                <Button disabled={submitting} onClick={() => handleSave("save-changes")}>
                  <Save size={16} /> {submitting ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="secondary" disabled={submitting} onClick={() => handleSave("unpublish")}>
                  <EyeOff size={16} /> Unpublish
                </Button>
              </>
            )}
            <Button variant="ghost" disabled={submitting} onClick={handleCancel} type="button">
              <X size={16} /> Cancel
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Preview</h3>
            <LinkButton href={`/lessons/${lesson.slug}`} variant="secondary" className="w-full justify-center">
              <Eye size={16} /> Preview Lesson
            </LinkButton>
            <p className="text-[11px] text-muted mt-2">
              {isDraft
                ? "Only you (and other hosts/admins for this church) can see this preview."
                : "This lesson is live in the public Lessons Library and church archive."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
