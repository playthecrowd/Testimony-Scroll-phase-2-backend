import { ChurchExperienceOccurrenceStatus, ChurchExperienceStatus, ChurchExperienceVisibility } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ChurchExperienceStatus, string> = {
  draft: "bg-surface-2 text-muted border-border-subtle",
  published: "bg-accent-blue/15 text-accent-blue-light border-accent-blue/30",
  archived: "bg-surface-2 text-muted border-border-subtle opacity-70",
};

const STATUS_LABELS: Record<ChurchExperienceStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function ExperienceStatusBadge({ status }: { status: ChurchExperienceStatus }) {
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
  );
}

const OCCURRENCE_STATUS_STYLES: Record<ChurchExperienceOccurrenceStatus, string> = {
  scheduled: "bg-accent-blue/15 text-accent-blue-light border-accent-blue/30",
  cancelled: "bg-red-500/10 text-red-300 border-red-500/30",
  completed: "bg-surface-2 text-muted border-border-subtle",
};

const OCCURRENCE_STATUS_LABELS: Record<ChurchExperienceOccurrenceStatus, string> = {
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function OccurrenceStatusBadge({ status }: { status: ChurchExperienceOccurrenceStatus }) {
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", OCCURRENCE_STATUS_STYLES[status])}>
      {OCCURRENCE_STATUS_LABELS[status]}
    </span>
  );
}

const VISIBILITY_LABELS: Record<ChurchExperienceVisibility, string> = {
  church_only: "Church Only",
  invited_only: "Invited Only",
  public: "Public",
};

export function ExperienceVisibilityBadge({ visibility }: { visibility: ChurchExperienceVisibility }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full border border-border-subtle text-muted font-medium">
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}

export const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  volunteer: "Volunteer",
  outreach: "Outreach",
  prayer_gathering: "Prayer Gathering",
  worship_gathering: "Worship Gathering",
  small_group: "Small Group",
  bible_study: "Bible Study",
  service_project: "Service Project",
  community_event: "Community Event",
  online_gathering: "Online Gathering",
  custom: "Custom",
};

export const EXPERIENCE_FORMAT_LABELS: Record<string, string> = {
  in_person: "In Person",
  online: "Online",
  hybrid: "Hybrid",
  self_guided: "Self-Guided",
};
