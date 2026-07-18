import Link from "next/link";
import { MapPin, Globe2 } from "lucide-react";
import { ChurchExperience } from "@/types";
import { EXPERIENCE_TYPE_LABELS, EXPERIENCE_FORMAT_LABELS } from "@/components/experiences/ExperienceStatusBadge";

export function ExperienceCard({ experience }: { experience: ChurchExperience }) {
  return (
    <Link href={`/experiences/${experience.id}`} className="qk-card p-4 flex flex-col gap-2 hover:border-accent-blue-light transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-accent-blue-light font-medium uppercase tracking-wide">
          {EXPERIENCE_TYPE_LABELS[experience.type] ?? experience.type}
        </span>
        <span className="text-[11px] text-muted flex items-center gap-1">
          {experience.format === "online" ? <Globe2 size={11} /> : <MapPin size={11} />}
          {EXPERIENCE_FORMAT_LABELS[experience.format] ?? experience.format}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground line-clamp-2">{experience.title}</p>
      {experience.summary && <p className="text-xs text-muted line-clamp-2">{experience.summary}</p>}
      {experience.locationName && <p className="text-[11px] text-muted mt-auto pt-2">{experience.locationName}</p>}
    </Link>
  );
}
