import Link from "next/link";
import { WorkforceDecision } from "@/types";
import { WorkforceDecisionStatusBadge } from "./WorkforceDecisionStatusBadge";

const PRIORITY_LABELS: Record<WorkforceDecision["priority"], string> = {
  standard: "Standard",
  elevated: "Elevated",
  strategic: "Strategic",
  critical: "Critical",
};

// WF-01 card fields per the UI content guide: decision ID, title, current stage (status here --
// see migration 0045's file header on why the Pathway stage engine is a separate, later concept),
// created by / owner is folded into a single line for Phase 2's simpler card, controlling
// stakeholder, participant count standing in for stakeholder avatars until real avatar rendering
// exists, stage progress is deferred to the stage engine (Phase 3), last updated.
export function DecisionCard({ decision }: { decision: WorkforceDecision }) {
  return (
    <Link
      href={`/workforce/decisions/${decision.id}`}
      className="qk-card p-4 flex flex-col gap-2.5 hover:border-accent-blue-light/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-mono text-muted">{decision.decisionNumber}</span>
        <WorkforceDecisionStatusBadge status={decision.status} />
      </div>
      <h3 className="font-semibold text-foreground leading-snug line-clamp-2">{decision.title}</h3>
      {decision.controllingStakeholderGroup && <p className="text-xs text-muted line-clamp-1">{decision.controllingStakeholderGroup}</p>}
      <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-muted border-t border-white/10">
        <span>{decision.decisionOwnerName ? `Owner: ${decision.decisionOwnerName}` : PRIORITY_LABELS[decision.priority]}</span>
        <span>
          {decision.participantCount} {decision.participantCount === 1 ? "participant" : "participants"}
        </span>
      </div>
    </Link>
  );
}
