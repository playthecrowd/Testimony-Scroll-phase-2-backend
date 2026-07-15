"use client";

import { useState } from "react";
import { Pencil, Eye, Send, EyeOff } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { publishLesson, unpublishLesson } from "@/app/lessons/[lessonId]/actions";
import { formatDate } from "@/lib/utils";
import { PublishedLesson } from "@/types";

// Host-facing lesson management: every lesson for the churches this Host manages, with
// Edit/Preview/Publish/Unpublish actions. Visibility of this whole list is gated by its caller
// (only rendered for an authenticated Host) -- Kingdom Members and anonymous visitors never see it.
export function HostLessonManagementList({ lessons }: { lessons: PublishedLesson[] }) {
  const [items, setItems] = useState(lessons);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handlePublish(lesson: PublishedLesson) {
    setPendingId(lesson.id);
    setError("");
    const result = await publishLesson(lesson.id, lesson.slug, lesson.church.slug);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: "published" } : l)));
  }

  async function handleUnpublish(lesson: PublishedLesson) {
    const confirmed = window.confirm(
      `Unpublish "${lesson.title}"? It will no longer appear in the public Lessons Library or church archive until you publish it again.`
    );
    if (!confirmed) return;
    setPendingId(lesson.id);
    setError("");
    const result = await unpublishLesson(lesson.id, lesson.slug, lesson.church.slug);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: "draft" } : l)));
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">You haven&apos;t built any lesson experiences yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {items.map((lesson) => {
        const isDraft = lesson.status === "draft";
        const busy = pendingId === lesson.id;
        return (
          <div key={lesson.id} className="qk-card p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    isDraft ? "bg-accent-gold/15 text-accent-gold" : "bg-accent-blue/15 text-accent-blue-light"
                  }`}
                >
                  {isDraft ? "Draft" : "Published"}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                {lesson.church.name} · Updated {formatDate(lesson.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <LinkButton href={`/experience-builder/${lesson.slug}/edit`} size="sm" variant="secondary">
                <Pencil size={13} /> Edit Experience
              </LinkButton>
              <LinkButton href={`/lessons/${lesson.slug}`} size="sm" variant="ghost">
                <Eye size={13} /> Preview
              </LinkButton>
              {isDraft ? (
                <Button size="sm" onClick={() => handlePublish(lesson)} disabled={busy}>
                  <Send size={13} /> {busy ? "Publishing..." : "Publish"}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => handleUnpublish(lesson)} disabled={busy}>
                  <EyeOff size={13} /> {busy ? "Unpublishing..." : "Unpublish"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
