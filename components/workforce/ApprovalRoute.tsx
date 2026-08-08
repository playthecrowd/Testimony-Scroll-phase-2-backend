import { UserCircle2, Building2, UserCheck, MailCheck, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: UserCircle2, label: "Stakeholder\nRequest" },
  { icon: Building2, label: "Department\nReview" },
  { icon: UserCheck, label: "Manager\nApproval" },
  { icon: MailCheck, label: "Person\nInvited" },
];

// Purely informational -- explains what "Request a Specific Person" actually routes through
// (spec's own helper text). Not tied to a specific request's live status; that's shown separately
// in the pending-requests list.
export function ApprovalRoute() {
  return (
    <div className="flex items-center justify-between gap-1">
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1 flex-1">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="w-9 h-9 rounded-full border border-accent-gold/40 bg-accent-gold/10 flex items-center justify-center shrink-0">
              <step.icon size={15} className="text-accent-gold" />
            </span>
            <span className="text-[10px] text-muted leading-tight whitespace-pre-line">{step.label}</span>
          </div>
          {i < STEPS.length - 1 && <ArrowRight size={13} className="text-border-subtle shrink-0 mb-4" />}
        </div>
      ))}
    </div>
  );
}
