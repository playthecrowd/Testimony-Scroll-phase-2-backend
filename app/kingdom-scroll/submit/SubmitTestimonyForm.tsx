"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { PublishedTestimonyVisibility, TestimonyIdentityDisplay } from "@/types";
import { submitTestimonyAction } from "./actions";

export interface EligibleLesson {
  id: string;
  title: string;
}

export function SubmitTestimonyForm({ eligibleLessons }: { eligibleLessons: EligibleLesson[] }) {
  const router = useRouter();
  const [primaryLessonId, setPrimaryLessonId] = useState(eligibleLessons[0]?.id ?? "");
  const [supportingLessonIds, setSupportingLessonIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [scripture, setScripture] = useState("");
  const [writtenTestimony, setWrittenTestimony] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [visibility, setVisibility] = useState<PublishedTestimonyVisibility>("church_only");
  const [identityDisplay, setIdentityDisplay] = useState<TestimonyIdentityDisplay>("first_name");
  const [suggestedCharacter, setSuggestedCharacter] = useState("");
  const [storyGenerationPermission, setStoryGenerationPermission] = useState(false);
  const [futureEpisodePermission, setFutureEpisodePermission] = useState(false);
  const [voiceLikenessPermission, setVoiceLikenessPermission] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function toggleSupporting(id: string) {
    setSupportingLessonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await submitTestimonyAction({
      primaryLessonId,
      supportingLessonIds: supportingLessonIds.filter((id) => id !== primaryLessonId),
      title,
      topic,
      scripture,
      writtenTestimony,
      videoUrl,
      audioUrl,
      visibility,
      identityDisplay,
      suggestedCharacter,
      storyGenerationPermission,
      futureEpisodePermission,
      voiceLikenessPermission,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    router.refresh();
  }

  if (eligibleLessons.length === 0) {
    return (
      <div className="qk-card p-10 text-center text-muted text-sm">
        Complete a lesson&apos;s Studied stage before submitting a testimony about it.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="qk-card p-10 text-center">
        <p className="text-foreground font-semibold mb-2">Testimony submitted.</p>
        <p className="text-sm text-muted">
          Your church will review it first. Public testimonies are then reviewed by Quest for the Kingdom before
          appearing on the Kingdom Scroll.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
      <Field label="Which lesson is this testimony about?" required>
        <select value={primaryLessonId} onChange={(e) => setPrimaryLessonId(e.target.value)} className="qk-input">
          {eligibleLessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </Field>

      {eligibleLessons.length > 1 && (
        <div>
          <span className="block text-xs font-medium text-muted mb-1.5">Other lessons this connects to (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {eligibleLessons
              .filter((l) => l.id !== primaryLessonId)
              .map((l) => (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => toggleSupporting(l.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    supportingLessonIds.includes(l.id)
                      ? "bg-accent-blue/15 border-accent-blue text-accent-blue-light"
                      : "border-border-subtle text-muted"
                  }`}
                >
                  {l.title}
                </button>
              ))}
          </div>
        </div>
      )}

      <Field label="Title" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., God Restored What I Thought Was Lost" className="qk-input" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Topic">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Scripture">
          <input value={scripture} onChange={(e) => setScripture(e.target.value)} placeholder="e.g., Joel 2:25" className="qk-input" />
        </Field>
      </div>

      <Field label="Your Testimony" required>
        <textarea
          value={writtenTestimony}
          onChange={(e) => setWrittenTestimony(e.target.value)}
          rows={6}
          placeholder="Share what happened and how this lesson connects to it."
          className="qk-input resize-none"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Video Link (optional)">
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className="qk-input" />
        </Field>
        <Field label="Audio Link (optional)">
          <input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Suggested Character (optional)">
        <input
          value={suggestedCharacter}
          onChange={(e) => setSuggestedCharacter(e.target.value)}
          placeholder="A Quest for the Kingdom character this reminds you of"
          className="qk-input"
        />
        <p className="text-[11px] text-muted mt-1">
          A suggestion only -- official character connections are made by Quest for the Kingdom.
        </p>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Who can see this?" required>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as PublishedTestimonyVisibility)} className="qk-input">
            <option value="private">Only me</option>
            <option value="church_only">My church</option>
            <option value="public">Public Kingdom Scroll (after review)</option>
          </select>
        </Field>
        <Field label="How should your name appear?" required>
          <select value={identityDisplay} onChange={(e) => setIdentityDisplay(e.target.value as TestimonyIdentityDisplay)} className="qk-input">
            <option value="full_name">Full name</option>
            <option value="first_name">First name only</option>
            <option value="username">Username</option>
            <option value="anonymous">Anonymous</option>
          </select>
        </Field>
      </div>

      <div className="space-y-2 pt-1">
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" checked={storyGenerationPermission} onChange={(e) => setStoryGenerationPermission(e.target.checked)} className="mt-0.5" />
          I give permission for this testimony to be shared, {visibility === "public" && <strong>required for a public submission</strong>}
          {visibility !== "public" && "if approved for that use"}.
        </label>
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" checked={futureEpisodePermission} onChange={(e) => setFutureEpisodePermission(e.target.checked)} className="mt-0.5" />
          I give permission for this story to inform a future Kingdom Scroll episode, if approved.
        </label>
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" checked={voiceLikenessPermission} onChange={(e) => setVoiceLikenessPermission(e.target.checked)} className="mt-0.5" />
          I give permission for my voice/likeness to be used in connection with this testimony, if approved.
        </label>
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        <Send size={16} /> {submitting ? "Submitting..." : "Submit Testimony"}
      </Button>
    </form>
  );
}
