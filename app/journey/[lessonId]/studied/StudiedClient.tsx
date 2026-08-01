"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Play,
  Headphones,
  FileText,
  Presentation,
  File as FileIcon,
  AlertTriangle,
  Save,
  Box,
  ChevronDown,
  XCircle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setChecklistItemCompletion, touchLastOpened, markStudiedComplete } from "@/services/supabase/journeys";
import { checkLessonQuestionAnswer } from "@/services/supabase/questions";
import { getMyProgressionAwardForSourceRow, getMyBadgeAwards } from "@/services/supabase/progression";
import { getApplicableChecklistItems, ChecklistItemKey } from "@/lib/journeyChecklist";
import { getYouTubeEmbedUrl } from "@/lib/videoEmbed";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { Button, LinkButton } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { PublishedLesson, LessonJourney, LessonJourneyItem, JourneyStage } from "@/types";

export function StudiedClient({
  lesson,
  initialJourney,
  initialItems,
}: {
  lesson: PublishedLesson;
  initialJourney: LessonJourney;
  initialItems: LessonJourneyItem[];
}) {
  const router = useRouter();

  const [journey, setJourney] = useState(initialJourney);
  const [items, setItems] = useState(initialItems);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [awardFeedback, setAwardFeedback] = useState<{ points: number; xp: number; badgeEarned: boolean } | null>(null);
  const [exiting, setExiting] = useState(false);
  const [exitMessage, setExitMessage] = useState("");
  const [tab, setTab] = useState<string>("Overview");

  // Real, Host-authored per-lesson questions as of Phase 3 (docs/PHASE3_AUDIT.md) -- previously
  // this read from data/questions.ts, a generic placeholder bank unrelated to what the Host
  // actually wrote (this file used to carry a note about that; see git history).
  const questions = lesson.questions;

  const applicableItems = useMemo(
    () => getApplicableChecklistItems({ ...lesson, media: lesson.media }),
    [lesson]
  );
  const completionByKey = useMemo(() => {
    const map = new Map<string, LessonJourneyItem>();
    items.forEach((item) => map.set(item.itemKey, item));
    return map;
  }, [items]);
  const questionsItemCompleted = completionByKey.get("questions")?.completed ?? false;

  // Per-question answer state (local UI state) -- the persisted checklist still only tracks one
  // "questions" item (lib/journeyChecklist.ts's fixed vocabulary), since lesson_questions rows are
  // recreated wholesale on every Host edit (no stable id to hang durable per-question progress off
  // of). If the aggregate item is already complete, every question starts locked-in as "correct"
  // (which id was actually selected doesn't matter once it's done) so a reload never re-demands an
  // already-completed learner redo work. If it isn't complete yet, every question starts fresh --
  // any earlier partial progress this session is lost on reload, but nothing "complete" is ever
  // erased, since nothing was complete yet.
  type QuestionAnswerStatus = "unanswered" | "checking" | "correct" | "incorrect";
  interface QuestionAnswerState {
    selectedChoiceId: string | null;
    status: QuestionAnswerStatus;
  }
  const [answerStates, setAnswerStates] = useState<Record<string, QuestionAnswerState>>(() => {
    const initial: Record<string, QuestionAnswerState> = {};
    questions.forEach((q) => {
      initial[q.id] = { selectedChoiceId: null, status: questionsItemCompleted ? "correct" : "unanswered" };
    });
    return initial;
  });
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});

  const completedCount = applicableItems.filter((def) => completionByKey.get(def.key)?.completed).length;
  const totalCount = applicableItems.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const isStudiedComplete = journey.currentStage !== "studied";

  const notesMedia = lesson.media.filter((m) => m.mediaType === "notes");
  const videoMedia = lesson.media.filter((m) => m.mediaType === "video");
  const audioMedia = lesson.media.filter((m) => m.mediaType === "audio");
  const slidesMedia = lesson.media.filter((m) => m.mediaType === "slides");
  const documentMedia = lesson.media.filter((m) => m.mediaType === "document");
  const transcriptMedia = lesson.media.filter((m) => m.mediaType === "transcript");

  const availableTabs = [
    "Overview",
    ...(notesMedia.length || transcriptMedia.length ? ["Notes"] : []),
    ...(videoMedia.length ? ["Video"] : []),
    ...(audioMedia.length ? ["Audio"] : []),
    ...(slidesMedia.length ? ["Slides"] : []),
    ...(documentMedia.length ? ["Documents"] : []),
    "Questions",
  ];
  const activeTab = availableTabs.includes(tab) ? tab : "Overview";

  async function toggleItem(key: ChecklistItemKey) {
    if (pendingKeys.has(key)) return; // reentrancy guard per item
    const current = completionByKey.get(key)?.completed ?? false;
    setPendingKeys((prev) => new Set(prev).add(key));
    setExitMessage("");
    try {
      const supabase = createClient();
      const updated = await setChecklistItemCompletion(supabase, journey.id, key, !current);
      setItems((prev) => {
        const next = prev.filter((i) => i.itemKey !== key);
        next.push(updated);
        return next;
      });
    } catch (err) {
      console.error(`[StudiedClient] Failed to save checklist item "${key}":`, err);
      setCompleteError("We couldn't save that item just now. Please try again.");
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function selectChoice(questionId: string, choiceId: string) {
    setAnswerStates((prev) => {
      const current = prev[questionId];
      if (!current || current.status === "correct" || current.status === "checking") return prev;
      // Choosing a different answer after an incorrect attempt clears that feedback -- the learner
      // gets a clean slate to try again, never a stale "incorrect" label sitting next to a choice
      // they haven't submitted yet.
      return { ...prev, [questionId]: { selectedChoiceId: choiceId, status: "unanswered" } };
    });
    setAnswerErrors((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  async function submitAnswer(questionId: string) {
    const current = answerStates[questionId];
    if (!current || !current.selectedChoiceId) return;
    if (current.status === "correct" || current.status === "checking") return;

    setAnswerStates((prev) => ({ ...prev, [questionId]: { ...prev[questionId], status: "checking" } }));
    setAnswerErrors((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });

    let correct: boolean;
    try {
      const supabase = createClient();
      // Only the three ids the learner actually chose ever leave the browser -- the server (a
      // SECURITY DEFINER RPC, migration 0043) is the only thing that ever sees or compares against
      // the real correct answer, and it returns nothing but this boolean.
      correct = await checkLessonQuestionAnswer(supabase, lesson.id, questionId, current.selectedChoiceId);
    } catch (err) {
      console.error(`[StudiedClient] Failed to check answer for question "${questionId}":`, err);
      setAnswerStates((prev) => ({ ...prev, [questionId]: { ...prev[questionId], status: "unanswered" } }));
      setAnswerErrors((prev) => ({ ...prev, [questionId]: "We couldn't check that answer just now. Please try again." }));
      return;
    }

    setAnswerStates((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], status: correct ? "correct" : "incorrect" },
    }));
    if (!correct) {
      setAnswerErrors((prev) => ({ ...prev, [questionId]: "Not quite -- choose an answer and try again." }));
    }
  }

  // Legacy questions authored before migration 0039 (never re-saved since) have zero configured
  // choices -- nothing to grade server-side. An explicit click here is still required (never
  // automatic on mount/tab-open) so this can't silently complete the aggregate item just because
  // the Questions tab was viewed.
  function markReviewed(questionId: string) {
    setAnswerStates((prev) => {
      const current = prev[questionId];
      if (!current || current.status === "correct") return prev;
      return { ...prev, [questionId]: { ...current, status: "correct" } };
    });
  }

  // Saving the aggregate "questions" completion is a side effect of every question reaching
  // "correct," not of any single submit -- doing it here (rather than inside submitAnswer's own
  // setState call) keeps setAnswerStates pure and avoids a double-fire under Strict Mode's dev-only
  // double-invoke of state updaters. questionsCompletionSavedRef mirrors this file's existing
  // startedForLessonRef pattern: a ref, not state, so the guard survives the same double-invoke.
  const questionsCompletionSavedRef = useRef(questionsItemCompleted);
  const allQuestionsCorrect = questions.length > 0 && questions.every((q) => answerStates[q.id]?.status === "correct");
  useEffect(() => {
    if (!allQuestionsCorrect || questionsCompletionSavedRef.current) return;
    questionsCompletionSavedRef.current = true;

    let cancelled = false;
    setPendingKeys((prev) => new Set(prev).add("questions"));
    setExitMessage("");
    (async () => {
      try {
        const supabase = createClient();
        const updated = await setChecklistItemCompletion(supabase, journey.id, "questions", true);
        if (cancelled) return;
        setItems((prev) => {
          const rest = prev.filter((i) => i.itemKey !== "questions");
          rest.push(updated);
          return rest;
        });
      } catch (err) {
        if (cancelled) return;
        console.error("[StudiedClient] Failed to save questions completion:", err);
        setCompleteError("We couldn't save your progress just now. Please try again.");
      } finally {
        if (!cancelled) {
          setPendingKeys((prev) => {
            const next = new Set(prev);
            next.delete("questions");
            return next;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allQuestionsCorrect, journey.id, questionsCompletionSavedRef]);

  async function handleSaveAndExit() {
    if (exiting) return;
    setExiting(true);
    setExitMessage("");
    try {
      const supabase = createClient();
      await touchLastOpened(supabase, journey.id);
      setExitMessage("Progress saved.");
      router.push("/my-journey");
    } catch (err) {
      console.error("[StudiedClient] Failed to save and exit:", err);
      setExitMessage("We couldn't save right now, but your checked items are already saved individually. Please try again.");
    } finally {
      setExiting(false);
    }
  }

  async function handleMarkComplete() {
    if (completing || isStudiedComplete) return;
    if (!allComplete) return;
    const confirmed = window.confirm("Mark the Studied stage complete? You can still revisit this lesson afterward.");
    if (!confirmed) return;

    setCompleting(true);
    setCompleteError("");
    try {
      const supabase = createClient();
      const updated = await markStudiedComplete(supabase, journey.id);
      setJourney(updated);

      // Phase 11.4: real, non-predictive completion feedback -- reads the exact award this
      // specific completion produced from progression_award_log (never guessed or computed
      // client-side), plus whether it also earned the "First Lesson Completed" badge. If the
      // award rule was inactive or something else prevented an award, this is simply null and no
      // feedback banner shows -- never a fabricated "you earned X" message.
      try {
        const award = await getMyProgressionAwardForSourceRow(supabase, journey.id);
        if (award) {
          const badges = await getMyBadgeAwards(supabase);
          const badgeEarned = badges.some((b) => b.awardSource === "lesson_studied" && b.relatedLessonId === lesson.id);
          setAwardFeedback({ points: award.pointsAwarded, xp: award.xpAwarded, badgeEarned });
        }
      } catch (awardErr) {
        // Feedback is a nice-to-have, not the source of truth for whether the stage completed --
        // the completion itself already succeeded above, so a failure here is logged, not surfaced
        // as an error to the member.
        console.error("[StudiedClient] Failed to load completion award feedback:", awardErr);
      }

      router.refresh();
    } catch (err) {
      console.error("[StudiedClient] Failed to mark Studied complete:", err);
      setCompleteError("We couldn't mark this stage complete right now. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  const stepperStage: JourneyStage = journey.currentStage === "experienced" ? "experienced" : "studied";

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId={lesson.id} currentStage={stepperStage} />
      </div>

      <Link href="/my-journey" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-3">
        <ArrowLeft size={15} /> Back to My Journey
      </Link>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="min-w-0">
          <div className="grid sm:grid-cols-[140px_1fr] gap-4 mb-5">
            <LessonThumbnail src={lesson.featuredImageUrl} alt={lesson.featuredImageAlt} rounded="rounded-xl" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{lesson.title}</h1>
              <p className="text-muted text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{lesson.church?.name ?? (lesson.isCampaignLesson ? lesson.campaignName || "Year-Round Campaign" : "")}</span>
                {lesson.speaker && <span>{lesson.speaker.name}</span>}
                {lesson.date && <span>{formatDate(lesson.date)}</span>}
                {lesson.primaryScripture && <span>Scripture: {lesson.primaryScripture}</span>}
              </p>
            </div>
          </div>

          <div className="lg:hidden mb-5">
            <ScripturePanel lesson={lesson} collapsible />
          </div>

          <div className="flex items-center gap-1 mb-5 border-b border-border-subtle overflow-x-auto qk-scrollbar">
            {availableTabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                  activeTab === t ? "border-accent-blue-light text-foreground" : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTab === "Overview" && (
            <div className="qk-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">About This Lesson</h3>
                {lesson.aboutText ? (
                  <p className="text-sm text-muted leading-relaxed">{lesson.aboutText}</p>
                ) : (
                  <p className="text-sm text-muted">No overview was provided for this lesson.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "Notes" && (
            <div className="qk-card p-5 space-y-4">
              {notesMedia.length === 0 && transcriptMedia.length === 0 && (
                <p className="text-sm text-muted">No notes were provided for this lesson.</p>
              )}
              {notesMedia.map((m) => (
                <MediaLink key={m.id} icon={FileText} label={m.title || "Open Notes"} url={m.url} content={m.content} />
              ))}
              {transcriptMedia.map((m) => (
                <MediaLink key={m.id} icon={FileText} label={m.title || "Transcript"} url={m.url} content={m.content} />
              ))}
            </div>
          )}

          {activeTab === "Video" && (
            <div className="qk-card p-5 space-y-4">
              {videoMedia.length === 0 && <p className="text-sm text-muted">No video was provided for this lesson.</p>}
              {videoMedia.map((m) => {
                const embedUrl = m.url ? getYouTubeEmbedUrl(m.url) : null;
                return embedUrl ? (
                  <div key={m.id} className="aspect-video rounded-lg overflow-hidden bg-surface-2">
                    <iframe
                      src={embedUrl}
                      title={m.title || "Lesson video"}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <MediaLink key={m.id} icon={Play} label={m.title || "Watch Video"} url={m.url} content={m.content} />
                );
              })}
            </div>
          )}

          {activeTab === "Audio" && (
            <div className="qk-card p-5 space-y-4">
              {audioMedia.length === 0 && <p className="text-sm text-muted">No audio was provided for this lesson.</p>}
              {audioMedia.map((m) => (
                <MediaLink key={m.id} icon={Headphones} label={m.title || "Listen to Audio"} url={m.url} content={m.content} />
              ))}
            </div>
          )}

          {activeTab === "Slides" && (
            <div className="qk-card p-5 space-y-4">
              {slidesMedia.length === 0 && <p className="text-sm text-muted">No slides were provided for this lesson.</p>}
              {slidesMedia.map((m) => (
                <MediaLink key={m.id} icon={Presentation} label={m.title || "View Slides"} url={m.url} content={m.content} />
              ))}
            </div>
          )}

          {activeTab === "Documents" && (
            <div className="qk-card p-5 space-y-4">
              {documentMedia.length === 0 && <p className="text-sm text-muted">No documents were provided for this lesson.</p>}
              {documentMedia.map((m) => (
                <MediaLink key={m.id} icon={FileIcon} label={m.title || "Open Document"} url={m.url} content={m.content} />
              ))}
            </div>
          )}

          {activeTab === "Questions" && (
            <div className="qk-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Study Questions</h3>
              {questions.length === 0 ? (
                <p className="text-sm text-muted">No questions were provided for this lesson.</p>
              ) : (
                <>
                  <p className="text-xs text-muted mb-4">Choose an answer and check it to complete each question.</p>
                  <ol className="space-y-5">
                    {questions.map((q, i) => {
                      const state = answerStates[q.id] ?? { selectedChoiceId: null, status: "unanswered" as const };
                      const hasChoices = q.choices.length === 4;
                      const locked = state.status === "correct" || isStudiedComplete;
                      const error = answerErrors[q.id];

                      return (
                        <li key={q.id} className="border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
                          <p className="text-sm font-medium text-foreground mb-2.5 flex items-start gap-2">
                            {state.status === "correct" ? (
                              <CheckCircle2 size={16} className="text-accent-blue-light shrink-0 mt-0.5" />
                            ) : (
                              <span className="text-accent-blue-light shrink-0">{i + 1}.</span>
                            )}
                            <span>{q.question}</span>
                          </p>

                          {!hasChoices ? (
                            <div className="ml-6">
                              {state.status === "correct" ? (
                                <p className="text-xs text-accent-blue-light flex items-center gap-1">
                                  <CheckCircle2 size={13} /> Reviewed
                                </p>
                              ) : (
                                <Button type="button" size="sm" onClick={() => markReviewed(q.id)} disabled={isStudiedComplete}>
                                  Mark Reviewed
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <fieldset disabled={locked || state.status === "checking"}>
                                <legend className="sr-only">Answer choices for question {i + 1}</legend>
                                <div className="space-y-2">
                                  {q.choices.map((c, ci) => {
                                    const selected = state.selectedChoiceId === c.id;
                                    return (
                                      <label
                                        key={c.id}
                                        className={cn(
                                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 min-h-[44px] transition-colors",
                                          locked || state.status === "checking" ? "cursor-not-allowed opacity-80" : "cursor-pointer",
                                          selected
                                            ? "border-accent-blue-light bg-accent-blue/10"
                                            : "border-border-subtle hover:border-accent-blue-light/60"
                                        )}
                                      >
                                        <input
                                          type="radio"
                                          name={`question-${q.id}`}
                                          checked={selected}
                                          onChange={() => selectChoice(q.id, c.id)}
                                          aria-label={`Question ${i + 1}, answer ${String.fromCharCode(65 + ci)}: ${c.answerText}`}
                                          className="shrink-0"
                                        />
                                        <span className="w-5 h-5 rounded-full border border-border-subtle flex items-center justify-center text-[11px] shrink-0">
                                          {String.fromCharCode(65 + ci)}
                                        </span>
                                        <span className="text-sm text-foreground break-words">{c.answerText}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </fieldset>

                              <div className="flex items-center gap-3">
                                {state.status !== "correct" && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => submitAnswer(q.id)}
                                    disabled={!state.selectedChoiceId || state.status === "checking" || isStudiedComplete}
                                  >
                                    {state.status === "checking" ? (
                                      <>
                                        <Loader2 size={14} className="animate-spin" /> Checking...
                                      </>
                                    ) : (
                                      "Check Answer"
                                    )}
                                  </Button>
                                )}
                                <div role="status" aria-live="polite" className="text-xs">
                                  {state.status === "correct" && (
                                    <span className="text-accent-blue-light flex items-center gap-1">
                                      <CheckCircle2 size={13} /> Correct
                                    </span>
                                  )}
                                  {state.status === "incorrect" && error && (
                                    <span className="text-red-300 flex items-center gap-1">
                                      <XCircle size={13} /> {error}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="hidden lg:block">
            <ScripturePanel lesson={lesson} />
          </div>

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Complete Your Study</h3>
            <p className="text-xs text-muted mb-3">Check off each item as you go. Your progress saves automatically.</p>
            <div className="space-y-2.5">
              {applicableItems.map((def) => {
                const completed = completionByKey.get(def.key)?.completed ?? false;
                const busy = pendingKeys.has(def.key);

                // Questions is acknowledged per-question in the Questions tab when real
                // questions exist -- this row becomes a read-only status, not a manual toggle,
                // so the two can't drift out of sync. With no real questions to check off
                // individually, it stays a plain manual toggle like every other item.
                if (def.key === "questions" && questions.length > 0) {
                  return (
                    <div key={def.key} className="w-full flex items-center gap-2.5">
                      {completed ? (
                        <CheckCircle2 size={17} className="text-accent-blue-light shrink-0" />
                      ) : (
                        <Circle size={17} className="text-muted shrink-0" />
                      )}
                      <span className={cn("text-sm flex-1", completed ? "text-foreground" : "text-muted")}>{def.label}</span>
                      {!completed && <span className="text-[10px] text-muted shrink-0">See Questions tab</span>}
                    </div>
                  );
                }

                return (
                  <button
                    key={def.key}
                    onClick={() => toggleItem(def.key)}
                    disabled={busy || isStudiedComplete}
                    aria-pressed={completed}
                    className="w-full flex items-center gap-2.5 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {completed ? (
                      <CheckCircle2 size={17} className="text-accent-blue-light shrink-0" />
                    ) : (
                      <Circle size={17} className="text-muted shrink-0" />
                    )}
                    <span className={cn("text-sm", completed ? "text-foreground" : "text-muted")}>{def.label}</span>
                  </button>
                );
              })}
            </div>

            {completeError && (
              <p className="text-xs text-red-300 mt-3 flex items-center gap-1.5">
                <AlertTriangle size={12} className="shrink-0" /> {completeError}
              </p>
            )}

            {isStudiedComplete ? (
              <p className="text-xs text-accent-blue-light text-center mt-4 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} /> Studied stage complete
              </p>
            ) : (
              <Button onClick={handleMarkComplete} disabled={!allComplete || completing} className="w-full justify-center mt-4">
                <Box size={16} /> {completing ? "Saving..." : "Mark Study Complete"}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleSaveAndExit}
              disabled={exiting}
              className="w-full justify-center mt-2"
            >
              <Save size={16} /> {exiting ? "Saving..." : "Save and Exit"}
            </Button>
            {exitMessage && <p className="text-xs text-muted text-center mt-2">{exitMessage}</p>}
          </div>

          <div className="qk-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Your Progress</h3>
            <p className="text-3xl font-bold text-accent-blue-light">{progress}%</p>
            <div className="h-1.5 rounded-full bg-surface-2 mt-2 overflow-hidden">
              <div className="h-full bg-accent-blue" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-muted mt-2">
              {completedCount} of {totalCount} items complete
            </p>
          </div>

          {awardFeedback && (awardFeedback.points > 0 || awardFeedback.xp > 0) && (
            <div className="qk-card p-4 qk-glow-gold" role="status">
              <p className="text-sm font-semibold text-foreground mb-1">Progress earned!</p>
              <p className="text-xs text-muted">
                {awardFeedback.points > 0 && <span className="text-accent-gold font-medium">+{awardFeedback.points} Points </span>}
                {awardFeedback.xp > 0 && <span className="text-accent-blue-light font-medium">+{awardFeedback.xp} XP</span>}
              </p>
              {awardFeedback.badgeEarned && (
                <p className="text-xs text-accent-gold font-medium mt-2">
                  New Badge Earned: First Lesson Completed! <Link href="/badges" className="underline">View Badges</Link>
                </p>
              )}
            </div>
          )}

          {isStudiedComplete && journey.completedAt && (
            // Server-confirmed full completion (migration 0042: completed_at is only ever set once
            // Study is done AND every required-linked Experience, if any, is satisfied) -- not just
            // "Studied stage complete." Routes to the Kingdom Scrolls Gateway, where real progress
            // toward the two-lesson unlock is computed from this same completed_at signal.
            <div className="qk-card p-4 qk-glow-blue">
              <p className="text-sm font-semibold text-foreground mb-1">Lesson complete!</p>
              <p className="text-xs text-muted mb-3">This lesson now counts toward your Kingdom Scrolls progress.</p>
              <LinkButton href="/kingdom-scrolls" className="w-full justify-center" aria-label="Go To Inventory Plot">
                <Box size={16} /> Go To Inventory Plot
              </LinkButton>
            </div>
          )}

          {isStudiedComplete && !journey.completedAt && (
            // Study is done but a required Experience is still pending (completed_at not yet set) --
            // unchanged link into the existing Experienced-stage flow, which is a separate,
            // still-mocked system (see experienced/page.tsx) that this checkpoint does not rebuild.
            <div className="qk-card p-4 qk-glow-blue">
              <p className="text-sm font-semibold text-foreground mb-1">Great job, keep going!</p>
              <p className="text-xs text-muted mb-3">The next stage of your journey is on its way.</p>
              <LinkButton href={`/journey/${lesson.id}/experienced`} className="w-full justify-center">
                <Box size={16} /> Continue Your Journey
              </LinkButton>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MediaLink({
  icon: Icon,
  label,
  url,
  content,
}: {
  icon: React.ElementType;
  label: string;
  url: string | null;
  content: string | null;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Icon size={15} className="text-accent-blue-light shrink-0" /> {label}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle hover:border-accent-blue-light text-foreground shrink-0"
          >
            <Icon size={13} /> Open
          </a>
        )}
      </div>
      {content && <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{content}</p>}
    </div>
  );
}

// Persistent scripture reference (Part 11) -- rendered twice by the caller: once as an always-
// expanded card in the desktop aside (visible regardless of which tab is active), and once as a
// collapsible accordion on mobile, positioned above the tab content instead of requiring a scroll
// past it. `collapsible` switches between those two presentations of the same content.
function ScripturePanel({ lesson, collapsible }: { lesson: PublishedLesson; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(!collapsible);
  if (!lesson.primaryScripture && lesson.supportingScriptures.length === 0) return null;

  return (
    <div className="qk-card p-4">
      {collapsible ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between text-left">
          <h3 className="text-sm font-semibold text-foreground">Scripture</h3>
          <ChevronDown size={16} className={cn("text-muted transition-transform", expanded && "rotate-180")} />
        </button>
      ) : (
        <h3 className="text-sm font-semibold text-foreground mb-2">Scripture</h3>
      )}
      {expanded && (
        <div className={collapsible ? "mt-3" : ""}>
          {lesson.primaryScripture && <p className="text-sm text-foreground font-medium mb-1.5">{lesson.primaryScripture}</p>}
          {lesson.supportingScriptures.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {lesson.supportingScriptures.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
