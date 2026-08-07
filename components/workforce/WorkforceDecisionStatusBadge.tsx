import { WorkforceDecisionStatus } from "@/types";

// Labels match the UI content guide's "Final status vocabulary" (docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md
// source package, PLOTABL_WORKFORCE_UI_CONTENT_AND_SCREEN_GUIDE.md section 10) exactly -- these are
// the approved product strings, not placeholders.
const STATUS_STYLES: Record<WorkforceDecisionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-2 text-muted" },
  stakeholder_review: { label: "Stakeholder Review", className: "bg-accent-gold/15 text-accent-gold" },
  awaiting_leadership_approval: { label: "Awaiting Leadership Approval", className: "bg-accent-gold/15 text-accent-gold" },
  department_translation: { label: "Department Translation", className: "bg-accent-blue/15 text-accent-blue-light" },
  management_planning: { label: "Management Planning", className: "bg-accent-blue/15 text-accent-blue-light" },
  employee_activation: { label: "Employee Activation", className: "bg-accent-blue/15 text-accent-blue-light" },
  in_implementation: { label: "In Implementation", className: "bg-accent-purple/15 text-accent-purple" },
  measuring_outcomes: { label: "Measuring Outcomes", className: "bg-accent-purple/15 text-accent-purple" },
  completed: { label: "Completed", className: "bg-green-500/15 text-green-300" },
  on_hold: { label: "On Hold", className: "bg-red-500/10 text-red-300" },
  archived: { label: "Archived", className: "bg-surface-2 text-muted" },
};

export function WorkforceDecisionStatusBadge({ status }: { status: WorkforceDecisionStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${className}`}>{label}</span>;
}
