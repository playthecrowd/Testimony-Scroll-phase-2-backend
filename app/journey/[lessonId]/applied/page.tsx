"use client";

import { use, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Feather,
  Lock,
  Globe2,
  Building2,
  Eye,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import { getLesson } from "@/services/lessonService";
import { useSession } from "@/context/SessionContext";
import { getUserJourneys, getJourney, startJourney, markTestimonySubmitted, completeApplied } from "@/services/journeyService";
import { submitTestimony, getTestimony, approveTestimony } from "@/services/testimonyService";
import { generateCharacterAndStory } from "@/services/storyService";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { Button, LinkButton } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { Journey, Testimony, TestimonyIdentity, TestimonyVisibility } from "@/types";

const steps = [
  "Select Your Lesson",
  "Share What You Learned",
  "Explain How It Applied",
  "Add Your Testimony",
  "Choose Permissions",
];

export default function AppliedStagePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const lesson = getLesson(lessonId);
  const { session, ready } = useSession();
  const router = useRouter();

  const [journey, setJourney] = useState<Journey | null>(null);
  const [step, setStep] = useState(0);
  const [supportingIds, setSupportingIds] = useState<string[]>([]);
  const [whatLearned, setWhatLearned] = useState("");
  const [situation, setSituation] = useState("");
  const [howApplied, setHowApplied] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [howHelpsOthers, setHowHelpsOthers] = useState("");
  const [writtenTestimony, setWrittenTestimony] = useState("");
  const [visibility, setVisibility] = useState<TestimonyVisibility>("public");
  const [identity, setIdentity] = useState<TestimonyIdentity>("first-name");
  const [permStory, setPermStory] = useState(true);
  const [permEpisode, setPermEpisode] = useState(true);
  const [permVoice, setPermVoice] = useState(true);
  const [submitted, setSubmitted] = useState<Testimony | null>(null);

  useEffect(() => {
    if (ready && session.isLoggedIn && lesson) {
      let j = getJourney(session.user.id, lesson.id);
      if (!j) j = startJourney(session.user.id, lesson.id);
      setJourney(j);
      if (j.testimonyId) {
        const t = getTestimony(j.testimonyId);
        if (t) setSubmitted(t);
      }
    }
  }, [ready, session, lesson]);

  if (!lesson) return notFound();
  if (!ready) return null;
  if (!session.isLoggedIn) {
    router.push("/login");
    return null;
  }
  if (!journey) return null;

  const otherCompleted = getUserJourneys(session.user.id).filter(
    (j) => j.lessonId !== lesson.id && (j.stage === "studied" || j.stage === "experienced" || j.stage === "applied" || j.stage === "added-to-story")
  );

  function toggleSupport(id: string) {
    setSupportingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));
  }

  function handleSubmit() {
    const t = submitTestimony({
      userId: session.user.id,
      primaryLessonId: lesson!.id,
      supportingLessonIds: supportingIds,
      whatLearned,
      howApplied,
      situation,
      actionTaken,
      howHelpsOthers,
      writtenTestimony,
      visibility,
      identityDisplay: identity,
      storyGenerationPermission: permStory,
      futureEpisodePermission: permEpisode,
      voiceLikenessPermission: permVoice,
      title: whatLearned.slice(0, 60) || "My Kingdom Testimony",
      topic: lesson!.topic,
      scripture: lesson!.primaryScripture,
    });
    markTestimonySubmitted(session.user.id, lesson!.id, t.id);
    setSubmitted(t);
  }

  function devApprove() {
    if (!submitted) return;
    const approved = approveTestimony(submitted.id);
    if (!approved) return;
    setSubmitted(approved);
    generateCharacterAndStory(approved);
    const updated = completeApplied(session.user.id, lesson!.id);
    setJourney(updated);
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6 overflow-x-auto qk-scrollbar">
          <JourneyStepper lessonId={lesson.id} currentStage={journey.stage} />
        </div>
        <div className="qk-card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto mb-4">
            <Feather size={24} className="text-accent-blue-light" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {submitted.status === "approved" ? "Testimony Approved!" : "Testimony Submitted"}
          </h1>
          <p className="text-muted text-sm mb-1">&ldquo;{submitted.title}&rdquo;</p>
          <span
            className={cn(
              "inline-block text-xs px-2.5 py-1 rounded-full mt-2 mb-6",
              submitted.status === "approved" ? "bg-accent-blue/15 text-accent-blue-light" : "bg-accent-gold/15 text-accent-gold"
            )}
          >
            {submitted.status === "approved" ? "Approved" : "Awaiting Review"}
          </span>

          {submitted.status === "approved" ? (
            <div>
              <p className="text-sm text-accent-blue-light mb-5">Kingdom Application Badge earned 🎉</p>
              <LinkButton href={`/journey/${lesson.id}/added-to-story`}>
                <Sparkles size={16} /> Continue: Added to the Story
              </LinkButton>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                A church host will review your testimony. In this prototype, you can simulate approval below.
              </p>
              <Button onClick={devApprove} variant="secondary">
                <FlaskConical size={16} /> Dev: Approve Testimony
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId={lesson.id} currentStage={journey.stage} />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-foreground">Apply &amp; Share Your Testimony</h1>
      <p className="text-muted text-sm mt-1 mb-6">Your story encourages others and advances the Kingdom.</p>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-1">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={cn(
                "w-full flex items-start gap-3 text-left px-3 py-3 rounded-lg transition-colors",
                step === i ? "bg-accent-blue/10 border border-accent-blue/30" : "hover:bg-white/5"
              )}
            >
              {i < step ? (
                <CheckCircle2 size={18} className="text-accent-blue-light shrink-0 mt-0.5" />
              ) : (
                <Circle size={18} className={cn("shrink-0 mt-0.5", step === i ? "text-accent-blue-light" : "text-muted")} />
              )}
              <span>
                <span className={cn("block text-sm font-medium", step === i ? "text-foreground" : "text-muted")}>
                  {i + 1}. {s}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="qk-card p-5 md:p-6">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Select Your Lesson</h2>
              <p className="text-sm text-muted mb-4">Choose the lesson that best fits your testimony.</p>
              <p className="text-xs font-medium text-muted mb-2">Primary Lesson</p>
              <div className="qk-card p-3 flex items-center gap-3 mb-5 border-accent-blue-light">
                <img src={lesson.featuredImageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                <div>
                  <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                  <p className="text-xs text-muted">{lesson.shortDescription}</p>
                </div>
                <CheckCircle2 size={16} className="text-accent-blue-light ml-auto shrink-0" />
              </div>
              <p className="text-xs font-medium text-muted mb-2">Supporting Lessons (Optional, up to 3)</p>
              <div className="space-y-2">
                {otherCompleted.map((j) => {
                  const l = getLesson(j.lessonId);
                  if (!l) return null;
                  const checked = supportingIds.includes(l.id);
                  return (
                    <label key={l.id} className="flex items-center gap-3 qk-card p-2.5 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleSupport(l.id)} />
                      <img src={l.featuredImageUrl} className="w-9 h-9 rounded-lg object-cover" alt="" />
                      <span className="text-sm text-foreground">{l.title}</span>
                    </label>
                  );
                })}
                {otherCompleted.length === 0 && <p className="text-xs text-muted">No other completed lessons yet.</p>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground mb-1">Share What You Learned</h2>
              <TextField label="What did you learn?" value={whatLearned} onChange={setWhatLearned} />
              <TextField label="What situation does the teaching connect to?" value={situation} onChange={setSituation} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground mb-1">Explain How It Applied</h2>
              <TextField label="How does the lesson apply to your life?" value={howApplied} onChange={setHowApplied} />
              <TextField label="What action, change, or decision came from it?" value={actionTaken} onChange={setActionTaken} />
              <TextField label="How could this testimony help someone else?" value={howHelpsOthers} onChange={setHowHelpsOthers} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground mb-1">Add Your Testimony</h2>
              <TextField label="Tell your story through text" value={writtenTestimony} onChange={setWrittenTestimony} rows={6} />
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="qk-card p-3 text-xs text-muted">Video-link placeholder — attach in Phase Two</div>
                <div className="qk-card p-3 text-xs text-muted">Audio-link placeholder — attach in Phase Two</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground mb-1">Choose Permissions</h2>
              <div>
                <p className="text-xs font-medium text-muted mb-2">Visibility</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["public", "Public", Globe2],
                      ["church-only", "Church Only", Building2],
                      ["private", "Private", Lock],
                    ] as const
                  ).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      onClick={() => setVisibility(val)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm",
                        visibility === val ? "border-accent-blue-light text-accent-blue-light bg-accent-blue/10" : "border-border-subtle text-muted"
                      )}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted mb-2">Display Identity</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["full-name", "Full Display Name"],
                      ["first-name", "First Name"],
                      ["username", "Username"],
                      ["anonymous", "Anonymous"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setIdentity(val)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-sm",
                        identity === val ? "border-accent-blue-light text-accent-blue-light bg-accent-blue/10" : "border-border-subtle text-muted"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <CheckboxRow label="Allow story-generation from this testimony" checked={permStory} onChange={setPermStory} />
                <CheckboxRow label="Allow use in a future episode" checked={permEpisode} onChange={setPermEpisode} />
                <CheckboxRow label="Allow voice and likeness in generated media" checked={permVoice} onChange={setPermVoice} />
              </div>
              <div className="qk-card p-3 flex items-center gap-2 text-xs text-muted">
                <Eye size={14} /> Review complete. Submitting will set status to Awaiting Review.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-subtle">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                Save &amp; Continue <ChevronRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                <Feather size={16} /> Submit Testimony
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus-ring resize-none"
        placeholder="Share your thoughts..."
      />
    </label>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
