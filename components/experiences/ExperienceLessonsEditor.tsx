"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedLesson, ChurchExperienceLessonLink, ChurchExperienceLessonRelationship } from "@/types";
import { replaceExperienceLessonsAction } from "@/app/host-dashboard/experiences/actions";

interface Selection {
  lessonId: string;
  relationship: ChurchExperienceLessonRelationship;
}

// Reuses the church's own managed lessons only (never another church's private/draft lessons --
// checkpoint 4's "never expose another church's private lessons"), and mirrors
// EpisodeLessonsEditor's toggle-to-select shape, extended with a per-selection relationship
// picker (required/recommended) since an Experience-to-lesson link carries more meaning than an
// episode-to-lesson one does.
export function ExperienceLessonsEditor({
  experienceId,
  churchLessons,
  initialLinks,
}: {
  experienceId: string;
  churchLessons: PublishedLesson[];
  initialLinks: ChurchExperienceLessonLink[];
}) {
  const [selections, setSelections] = useState<Selection[]>(
    initialLinks.map((l) => ({ lessonId: l.lessonId, relationship: l.relationship }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggle(lessonId: string) {
    setSaved(false);
    setSelections((prev) =>
      prev.some((s) => s.lessonId === lessonId)
        ? prev.filter((s) => s.lessonId !== lessonId)
        : [...prev, { lessonId, relationship: "recommended" }]
    );
  }

  function setRelationship(lessonId: string, relationship: ChurchExperienceLessonRelationship) {
    setSaved(false);
    setSelections((prev) => prev.map((s) => (s.lessonId === lessonId ? { ...s, relationship } : s)));
  }

  async function handleSave() {
    setSubmitting(true);
    setError("");
    const result = await replaceExperienceLessonsAction(
      experienceId,
      selections.map((s, index) => ({
        lessonId: s.lessonId,
        relationship: s.relationship,
        sortOrder: index,
        hostNotes: "",
        reflectionPromptOverride: "",
      }))
    );
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  if (churchLessons.length === 0) {
    return <p className="text-sm text-muted">No lessons exist yet for this church to connect.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
        {churchLessons.map((lesson) => {
          const selection = selections.find((s) => s.lessonId === lesson.id);
          const selected = !!selection;
          return (
            <div key={lesson.id} className={`qk-card p-2.5 flex items-center gap-2.5 ${selected ? "border-accent-blue-light" : ""}`}>
              <button
                type="button"
                onClick={() => toggle(lesson.id)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${selected ? "bg-accent-blue border-accent-blue" : "border-border-subtle"}`}>
                  {selected && <Check size={11} className="text-white" />}
                </div>
                <span className="text-xs text-foreground truncate">{lesson.title}</span>
              </button>
              {selected && (
                <select
                  value={selection!.relationship}
                  onChange={(e) => setRelationship(lesson.id, e.target.value as ChurchExperienceLessonRelationship)}
                  className="qk-input w-auto text-[11px] py-1 shrink-0"
                >
                  <option value="recommended">Recommended</option>
                  <option value="required">Required</option>
                </select>
              )}
            </div>
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
