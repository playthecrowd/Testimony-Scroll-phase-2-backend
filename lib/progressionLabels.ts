import { ProgressionEventType } from "@/types";

// Phase 11.4: safe, human-readable labels for progression_award_log's fixed event_type enum --
// never the raw internal event_type string, and never any internal id/idempotency key, shown
// directly to a member (spec Step 10: "Do not display raw internal metadata... implementation
// details").
export const PROGRESSION_EVENT_LABELS: Record<ProgressionEventType, string> = {
  lesson_studied: "Completed a lesson",
  experience_completed: "Completed an Experience",
  testimony_submitted: "Submitted a testimony",
  testimony_church_approved: "Testimony approved by your church",
  testimony_kingdom_scroll_published: "Testimony published to the Kingdom Scroll",
};
