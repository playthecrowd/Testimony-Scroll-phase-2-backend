"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedLesson, EpisodeLessonLink } from "@/types";
import { updateEpisodeLessonsAction } from "@/app/admin/episodes/actions";

export function EpisodeLessonsEditor({
  episodeId,
  publishedLessons,
  initialSelections,
}: {
  episodeId: string;
  publishedLessons: PublishedLesson[];
  initialSelections: EpisodeLessonLink[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelections.map((s) => s.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSaved(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSubmitting(true);
    setError("");
    const result = await updateEpisodeLessonsAction(episodeId, selectedIds);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  if (publishedLessons.length === 0) {
    return <p className="text-sm text-muted">No published lessons exist yet to connect.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
        {publishedLessons.map((l) => {
          const selected = selectedIds.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle(l.id)}
              className={`w-full flex items-center gap-2.5 text-left qk-card p-2.5 ${selected ? "border-accent-blue-light" : ""}`}
            >
              <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${selected ? "bg-accent-blue border-accent-blue" : "border-border-subtle"}`}>
                {selected && <Check size={11} className="text-white" />}
              </div>
              <span className="text-xs text-foreground truncate">{l.title}</span>
              <span className="text-[11px] text-muted ml-auto shrink-0">{l.church?.name ?? (l.isCampaignLesson ? "Year-Round Campaign" : "")}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-accent-blue-light">Saved.</p>}

      <Button size="sm" onClick={handleSave} disabled={submitting}>
        {submitting ? "Saving..." : "Save Lessons"}
      </Button>
    </div>
  );
}
