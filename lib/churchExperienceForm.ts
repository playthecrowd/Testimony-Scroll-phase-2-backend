import {
  ChurchExperienceCompletionMethod,
  ChurchExperienceFormat,
  ChurchExperienceStatus,
  ChurchExperienceType,
  ChurchExperienceVisibility,
} from "@/types";

// Shared between the host create/edit Experience form and its server action (Phase 10.3), so both
// enforce identical rules rather than drifting apart -- same reasoning as lib/lessonForm.ts's own
// shared-validation comment. Returns a field-name -> message map (empty object = valid), richer
// than lib/lessonForm.ts's single-message return, since these forms need per-field inline errors.

const EXPERIENCE_TYPES: ChurchExperienceType[] = [
  "volunteer",
  "outreach",
  "prayer_gathering",
  "worship_gathering",
  "small_group",
  "bible_study",
  "service_project",
  "community_event",
  "online_gathering",
  "custom",
];

const EXPERIENCE_FORMATS: ChurchExperienceFormat[] = ["in_person", "online", "hybrid", "self_guided"];
const EXPERIENCE_VISIBILITIES: ChurchExperienceVisibility[] = ["church_only", "invited_only", "public"];
const EXPERIENCE_COMPLETION_METHODS: ChurchExperienceCompletionMethod[] = ["host_marked", "self_attested"];
const EXPERIENCE_STATUSES: ChurchExperienceStatus[] = ["draft", "published", "archived"];

// Only http/https are ever accepted, same rule as lib/lessonForm.ts's isValidMediaUrl -- but empty
// is NOT valid here, since this is used only where a URL is actually required (an online/hybrid
// Experience's meeting link), not an optional media field.
function isUsableHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface ValidateExperienceInput {
  churchId: string;
  title: string;
  type: ChurchExperienceType;
  customTypeLabel: string | null;
  format: ChurchExperienceFormat;
  visibility: ChurchExperienceVisibility;
  completionMethod: ChurchExperienceCompletionMethod;
  status?: ChurchExperienceStatus;
  ministryId?: string | null;
  defaultCapacity?: number | null;
}

export function validateExperienceInput(input: ValidateExperienceInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.churchId?.trim()) errors.churchId = "A church is required.";
  if (!input.title?.trim()) errors.title = "Title is required.";

  if (!EXPERIENCE_TYPES.includes(input.type)) {
    errors.type = "A valid Experience type is required.";
  } else if (input.type === "custom" && !input.customTypeLabel?.trim()) {
    errors.customTypeLabel = 'A custom type label is required when type is "Custom".';
  }

  if (!EXPERIENCE_FORMATS.includes(input.format)) errors.format = "A valid format is required.";
  if (!EXPERIENCE_VISIBILITIES.includes(input.visibility)) errors.visibility = "A valid visibility is required.";
  if (!EXPERIENCE_COMPLETION_METHODS.includes(input.completionMethod)) errors.completionMethod = "A valid completion method is required.";
  if (input.status !== undefined && !EXPERIENCE_STATUSES.includes(input.status)) errors.status = "Invalid status.";

  if (input.defaultCapacity != null && (!Number.isInteger(input.defaultCapacity) || input.defaultCapacity <= 0)) {
    errors.defaultCapacity = "Default capacity must be empty (unlimited) or a positive whole number.";
  }

  return errors;
}

export interface ValidateOccurrenceInput {
  experienceId: string;
  churchId: string;
  // The parent Experience's format/default location/URL -- location/URL requirements depend on
  // the Experience's format, since occurrences don't carry their own separate format field (an
  // occurrence's location_name/online_url are overrides of the Experience's own defaults).
  experienceFormat: ChurchExperienceFormat;
  experienceLocationName: string | null;
  experienceOnlineUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  locationName: string | null;
  onlineUrl: string | null;
  capacity: number | null;
}

export function validateOccurrenceInput(input: ValidateOccurrenceInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.experienceId?.trim()) errors.experienceId = "An Experience is required.";
  if (!input.churchId?.trim()) errors.churchId = "A church is required.";
  if (!input.startsAt?.trim()) errors.startsAt = "A start date and time is required.";
  if (!input.timezone?.trim()) errors.timezone = "A timezone is required.";

  if (input.startsAt && input.endsAt) {
    const startsMs = Date.parse(input.startsAt);
    const endsMs = Date.parse(input.endsAt);
    if (!Number.isNaN(startsMs) && !Number.isNaN(endsMs) && endsMs <= startsMs) {
      errors.endsAt = "End time must be after start time.";
    }
  }

  if (input.capacity != null && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    errors.capacity = "Capacity must be empty (unlimited) or a positive whole number.";
  }

  const effectiveLocation = input.locationName ?? input.experienceLocationName;
  const effectiveUrl = input.onlineUrl ?? input.experienceOnlineUrl;

  if ((input.experienceFormat === "in_person" || input.experienceFormat === "hybrid") && !effectiveLocation?.trim()) {
    errors.locationName = "A location is required for an in-person or hybrid Experience.";
  }
  if ((input.experienceFormat === "online" || input.experienceFormat === "hybrid") && !isUsableHttpUrl(effectiveUrl)) {
    errors.onlineUrl = "A usable meeting link (http/https) is required for an online or hybrid Experience.";
  }

  return errors;
}

// Friendly, client-side-first check before hitting church_experience_lessons' own
// unique(experience_id, lesson_id) constraint -- mirrors how lib/lessonForm.ts's validators exist
// to give a clear message before the database's own constraint would otherwise raise one.
export function findDuplicateLessonSelections(lessonIds: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of lessonIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return Array.from(duplicates);
}
