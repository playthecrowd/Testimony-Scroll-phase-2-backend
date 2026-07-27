"use client";

import { useState } from "react";
import { Star, Sparkles, Send, EyeOff, Pencil } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { PublishedLesson } from "@/types";
import {
  setCampaignLessonStatusAction,
  setCampaignLessonFeaturedAction,
  setCampaignLessonHighlightedAction,
} from "@/app/admin/campaign-lessons/actions";

export function CampaignLessonsList({ lessons: initial }: { lessons: PublishedLesson[] }) {
  const [lessons, setLessons] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function togglePublished(lesson: PublishedLesson) {
    setPendingId(lesson.id);
    setError("");
    const nextStatus = lesson.status === "published" ? "draft" : "published";
    const result = await setCampaignLessonStatusAction(lesson.id, nextStatus);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: nextStatus } : l)));
  }

  async function toggleFeatured(lesson: PublishedLesson) {
    setPendingId(lesson.id);
    setError("");
    const result = await setCampaignLessonFeaturedAction(lesson.id, !lesson.featured);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, featured: !lesson.featured } : l)));
  }

  async function toggleHighlighted(lesson: PublishedLesson) {
    setPendingId(lesson.id);
    setError("");
    const result = await setCampaignLessonHighlightedAction(lesson.id, !lesson.isHighlighted);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, isHighlighted: !lesson.isHighlighted } : l)));
  }

  if (lessons.length === 0) {
    return <p className="text-sm text-muted">No campaign lessons yet. Create one, or bulk-upload a CSV.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {lessons.map((lesson) => {
        const busy = pendingId === lesson.id;
        const isDraft = lesson.status === "draft";
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
                {lesson.campaignName || "Year-Round Campaign"}
                {lesson.campaignMonth && ` · ${lesson.campaignMonth}`}
                {lesson.campaignWeekNumber ? ` Week ${lesson.campaignWeekNumber}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <LinkButton href={`/admin/campaign-lessons/${lesson.id}/edit`} size="sm" variant="secondary">
                <Pencil size={13} /> Edit
              </LinkButton>
              <Button size="sm" variant={lesson.featured ? "secondary" : "ghost"} disabled={busy} onClick={() => toggleFeatured(lesson)}>
                <Star size={13} fill={lesson.featured ? "currentColor" : "none"} /> {lesson.featured ? "Featured" : "Feature"}
              </Button>
              <Button size="sm" variant={lesson.isHighlighted ? "secondary" : "ghost"} disabled={busy} onClick={() => toggleHighlighted(lesson)}>
                <Sparkles size={13} fill={lesson.isHighlighted ? "currentColor" : "none"} /> {lesson.isHighlighted ? "Highlighted" : "Highlight"}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => togglePublished(lesson)}>
                {isDraft ? (
                  <>
                    <Send size={13} /> Publish
                  </>
                ) : (
                  <>
                    <EyeOff size={13} /> Unpublish
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
