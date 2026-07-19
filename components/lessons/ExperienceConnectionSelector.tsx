"use client";

import { Check } from "lucide-react";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { Experience } from "@/types";

export interface ExperienceSelection {
  experienceId: string;
  relationshipNote: string;
}

interface ExperienceConnectionSelectorProps {
  experiences: Experience[];
  selections: ExperienceSelection[];
  onChange: (selections: ExperienceSelection[]) => void;
  disabled?: boolean;
}

// Multi-select from the real experiences catalog (docs/PHASE3_AUDIT.md section 3c) with a preview
// card per experience and an optional relationship/reason note per selection -- replaces the raw
// Quest Launch URL field as the primary way to connect a lesson to a Quest for the Kingdom
// experience. Hosts can still select zero and rely on the legacy manual quest_url field instead
// (kept as a fallback field elsewhere in the form).
export function ExperienceConnectionSelector({ experiences, selections, onChange, disabled }: ExperienceConnectionSelectorProps) {
  function isSelected(experienceId: string) {
    return selections.some((s) => s.experienceId === experienceId);
  }

  function toggle(experienceId: string) {
    if (isSelected(experienceId)) {
      onChange(selections.filter((s) => s.experienceId !== experienceId));
    } else {
      onChange([...selections, { experienceId, relationshipNote: "" }]);
    }
  }

  function updateNote(experienceId: string, note: string) {
    onChange(selections.map((s) => (s.experienceId === experienceId ? { ...s, relationshipNote: note } : s)));
  }

  if (experiences.length === 0) {
    return (
      <p className="text-sm text-muted">No experiences are available to connect yet. You can still add a manual Quest Launch URL below.</p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {experiences.map((experience) => {
        const selected = isSelected(experience.id);
        const selection = selections.find((s) => s.experienceId === experience.id);
        return (
          <div
            key={experience.id}
            className={`qk-card p-3 space-y-2.5 ${selected ? "border-accent-blue-light qk-glow-blue" : ""}`}
          >
            <button
              type="button"
              onClick={() => toggle(experience.id)}
              disabled={disabled}
              className="flex items-start gap-3 w-full text-left disabled:cursor-not-allowed"
            >
              <LessonThumbnail
                src={experience.previewImageUrl}
                alt=""
                aspect="square"
                rounded="rounded-lg"
                className="w-14 h-14 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{experience.name}</p>
                {experience.description && <p className="text-xs text-muted mt-0.5 line-clamp-2">{experience.description}</p>}
              </div>
              <div
                className={`w-5 h-5 rounded-md border shrink-0 flex items-center justify-center ${
                  selected ? "bg-accent-blue border-accent-blue" : "border-border-subtle"
                }`}
              >
                {selected && <Check size={13} className="text-white" />}
              </div>
            </button>
            {selected && (
              <input
                value={selection?.relationshipNote ?? ""}
                onChange={(e) => updateNote(experience.id, e.target.value)}
                placeholder="Why does this lesson relate to this experience? (optional)"
                disabled={disabled}
                className="qk-input text-xs"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
