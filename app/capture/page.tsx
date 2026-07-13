"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { churches } from "@/data/churches";
import { submitCapturedLesson } from "@/services/lessonService";
import { getAllLessons } from "@/services/lessonService";
import { Button, LinkButton } from "@/components/ui/Button";
import { JourneyStepper } from "@/components/journey/JourneyStepper";
import { Lesson } from "@/types";

const lessonTypes: Lesson["lessonType"][] = ["sermon", "bible-study", "youth", "devotional", "series"];

export default function CapturePage() {
  const { session, ready } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [churchId, setChurchId] = useState(churches[0].id);
  const [speakerName, setSpeakerName] = useState("");
  const [date, setDate] = useState("");
  const [lessonType, setLessonType] = useState<Lesson["lessonType"]>("sermon");
  const [ministryCategory, setMinistryCategory] = useState("");
  const [notesUrl, setNotesUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [slidesUrl, setSlidesUrl] = useState("");
  const [primaryScripture, setPrimaryScripture] = useState("");
  const [supportingScriptures, setSupportingScriptures] = useState("");
  const [questUrl, setQuestUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Lesson | null>(null);

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to capture a lesson.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const recentChurchLessons = getAllLessons()
    .filter((l) => l.churchId === churchId)
    .slice(0, 3);

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      setTags((t) => Array.from(new Set([...t, tagInput.trim()])));
      setTagInput("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title || !topic || !shortDescription || !speakerName || !date || !ministryCategory || !primaryScripture) {
      setError("Please complete all required fields marked with *.");
      return;
    }
    if (!notesUrl && !videoUrl && !audioUrl && !slidesUrl) {
      setError("At least one content source (notes, video, audio, or slides) is required.");
      return;
    }
    const lesson = submitCapturedLesson({
      title,
      topic,
      shortDescription,
      churchId,
      speakerId: "spk-daniel-okoro",
      speakerName,
      date,
      lessonType,
      ministryCategory,
      notesUrl: notesUrl || undefined,
      videoUrl: videoUrl || undefined,
      audioUrl: audioUrl || undefined,
      slidesUrl: slidesUrl || undefined,
      primaryScripture,
      supportingScriptures: supportingScriptures.split(",").map((s) => s.trim()).filter(Boolean),
      tags,
      questUrl: questUrl || undefined,
    });
    setCreated(lesson);
  }

  if (created) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={26} className="text-accent-blue-light" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Lesson Submitted</h1>
        <p className="text-muted text-sm mb-8">
          &ldquo;{created.title}&rdquo; was added to the Lessons Library and to your church archive.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href={`/lessons/${created.slug}`}>View Lesson</LinkButton>
          <LinkButton href={`/churches/${created.churchId}`} variant="secondary">
            View Church Archive
          </LinkButton>
          <button
            onClick={() => {
              setCreated(null);
              setTitle("");
              setTopic("");
              setShortDescription("");
            }}
            className="text-sm text-muted hover:text-foreground underline"
          >
            Capture another lesson
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground">Capture a Lesson</h1>
      <p className="text-muted text-sm mt-1 mb-5">Share what God is teaching. Your lesson starts the journey.</p>

      <div className="mb-6 overflow-x-auto qk-scrollbar">
        <JourneyStepper lessonId="new" currentStage="not-started" linkBase={() => "/capture"} />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Lesson Details</h2>
          <p className="text-xs text-muted -mt-3">Provide the key details about this lesson.</p>

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
              <select value={lessonType} onChange={(e) => setLessonType(e.target.value as Lesson["lessonType"])} className="qk-input">
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

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Slides Link">
              <input value={slidesUrl} onChange={(e) => setSlidesUrl(e.target.value)} placeholder="https://yourchurch.com/slides" className="qk-input" />
            </Field>
            <Field label="Quest Launch URL (Optional)">
              <input value={questUrl} onChange={(e) => setQuestUrl(e.target.value)} placeholder="https://questforthekingdom.com/quest/your-quest-id" className="qk-input" />
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
            <p className="text-[11px] text-muted mt-1">Add keywords to help others find your lesson</p>
          </Field>

          {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="secondary">
              <Save size={16} /> Save Draft
            </Button>
            <Button type="submit">
              <Send size={16} /> Submit Lesson
            </Button>
            <Link href={`/churches/${churchId}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground px-4 py-2.5">
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
              <Link href={`/churches/${churchId}`} className="text-xs text-accent-blue-light hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentChurchLessons.map((l) => (
                <div key={l.id} className="flex items-center gap-2.5">
                  <img src={l.featuredImageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{l.title}</p>
                    <p className="text-[11px] text-muted">{l.date}</p>
                  </div>
                  <span className="text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full">Published</span>
                </div>
              ))}
              {recentChurchLessons.length === 0 && <p className="text-xs text-muted">No lessons yet for this church.</p>}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .qk-input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: 0.5rem;
          padding: 0.6rem 0.85rem;
          font-size: 0.875rem;
          color: var(--foreground);
        }
        .qk-input::placeholder {
          color: var(--muted);
        }
        .qk-input:focus {
          outline: 2px solid var(--accent-blue-light);
          outline-offset: 1px;
        }
      `}</style>
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
