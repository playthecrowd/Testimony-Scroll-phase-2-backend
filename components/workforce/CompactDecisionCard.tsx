import Link from "next/link";
import { WorkforceDecision } from "@/types";
import { WorkforceDecisionStatusBadge } from "./WorkforceDecisionStatusBadge";
import { WorkforceAvatar } from "./WorkforceAvatar";
import { STAGE_ORDER } from "@/services/supabase/workforceStages";

// Derived from the real status column, not a separate stored field -- there is no progress_percent
// on wf_decisions. completed reads as 100%, draft/on_hold/archived as 0% (outside the pathway
// entirely), everything else as its position in the 7-stage pathway.
function progressPercent(status: WorkforceDecision["status"]): number {
  if (status === "completed") return 100;
  const index = STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);
  if (index < 0) return 0;
  return Math.round(((index + 1) / STAGE_ORDER.length) * 100);
}

// One reusable card for both the Other Decisions rail and (later) any other compact decision
// listing -- accentClass lets a caller vary the left-edge/badge tint without a second component.
export function CompactDecisionCard({ decision }: { decision: WorkforceDecision }) {
  const progress = progressPercent(decision.status);
  const ownerName = decision.decisionOwnerName ?? decision.createdByName ?? "Unassigned";

  return (
    <Link href={`/workforce/decisions/${decision.id}`} className="qk-card rounded-xl p-3 block hover:border-accent-blue/50 transition-colors group">
      <div className="text-[11px] font-mono text-muted mb-1">{decision.decisionNumber}</div>
      <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-accent-blue transition-colors">
        {decision.title}
      </div>
      <div className="mt-2">
        <WorkforceDecisionStatusBadge status={decision.status} />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <WorkforceAvatar name={ownerName} size="xs" />
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground truncate">{ownerName}</div>
          {decision.controllingStakeholderGroup && <div className="text-[11px] text-muted truncate">{decision.controllingStakeholderGroup}</div>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent-blue rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[11px] text-muted shrink-0">{progress}%</span>
      </div>
    </Link>
  );
}
