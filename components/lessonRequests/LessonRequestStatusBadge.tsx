import { LessonRequestStatus } from "@/types";

const STATUS_STYLES: Record<LessonRequestStatus, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-surface-2 text-muted" },
  under_review: { label: "Under Review", className: "bg-accent-gold/15 text-accent-gold" },
  approved: { label: "Approved", className: "bg-accent-blue/15 text-accent-blue-light" },
  declined: { label: "Declined", className: "bg-red-500/10 text-red-300" },
  fulfilled: { label: "Fulfilled", className: "bg-accent-purple/15 text-accent-purple" },
};

// Shared by every surface that shows a lesson_requests row (member's own requests, a church's
// request queue, admin moderation, the public approved list) so the five statuses always read the
// same way everywhere.
export function LessonRequestStatusBadge({ status }: { status: LessonRequestStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${className}`}>{label}</span>;
}
