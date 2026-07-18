"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedLesson } from "@/types";
import { updateLessonFeaturedAction } from "@/app/admin/lessons/actions";

export function LessonsFeaturedList({ lessons: initial }: { lessons: PublishedLesson[] }) {
  const [lessons, setLessons] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(id: string, featured: boolean) {
    setPendingId(id);
    setError("");
    const result = await updateLessonFeaturedAction(id, featured);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, featured } : l)));
  }

  if (lessons.length === 0) {
    return <p className="text-sm text-muted">No published lessons yet.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {lessons.map((l) => {
        const busy = pendingId === l.id;
        return (
          <div key={l.id} className="qk-card p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
              <p className="text-[11px] text-muted truncate">{l.church.name}</p>
            </div>
            <Button size="sm" variant={l.featured ? "secondary" : "ghost"} disabled={busy} onClick={() => toggle(l.id, !l.featured)}>
              <Star size={13} fill={l.featured ? "currentColor" : "none"} /> {l.featured ? "Featured" : "Feature"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
