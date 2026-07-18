"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ChurchExperience, ChurchMinistry } from "@/types";
import { ExperienceCard } from "@/components/experiences/ExperienceCard";
import { EXPERIENCE_TYPE_LABELS, EXPERIENCE_FORMAT_LABELS } from "@/components/experiences/ExperienceStatusBadge";
import { EmptyState } from "@/components/ui/AsyncState";

// Member-facing Experience discovery filter bar + grid (Phase 10.3, checkpoint 5). Filtering
// happens client-side over an already church-scoped, already-published server fetch -- the same
// shape as /lessons' own filter bar -- never a second, unscoped query.
export function ExperiencesBrowser({ experiences, ministries }: { experiences: ChurchExperience[]; ministries: ChurchMinistry[] }) {
  const [type, setType] = useState("all");
  const [format, setFormat] = useState("all");
  const [ministryId, setMinistryId] = useState("all");

  const filtered = useMemo(() => {
    return experiences.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (format !== "all" && e.format !== format) return false;
      if (ministryId !== "all" && e.ministryId !== ministryId) return false;
      return true;
    });
  }, [experiences, type, format, ministryId]);

  return (
    <div>
      <div className="qk-card p-4 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <label className="block">
          <span className="block text-[11px] font-medium text-muted mb-1">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="qk-input">
            <option value="all">All Types</option>
            {Object.entries(EXPERIENCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-muted mb-1">Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="qk-input">
            <option value="all">All Formats</option>
            {Object.entries(EXPERIENCE_FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-muted mb-1">Ministry</span>
          <select value={ministryId} onChange={(e) => setMinistryId(e.target.value)} className="qk-input">
            <option value="all">All Ministries</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setType("all");
            setFormat("all");
            setMinistryId("all");
          }}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground justify-center py-2.5"
        >
          <X size={13} /> Clear Filters
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No Experiences match your filters yet." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </div>
      )}
    </div>
  );
}
