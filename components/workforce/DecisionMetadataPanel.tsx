import { Shield, User, Flag, Calendar, Lock, Clock } from "lucide-react";
import { WorkforceAvatar } from "./WorkforceAvatar";
import { WorkforceDecision } from "@/types";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-border-subtle last:border-b-0">
      <Icon size={15} className="text-accent-gold mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="text-sm text-foreground font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

// The narrow metadata card beside the hero visual (WF-02). "Creator title" (e.g. a job title) is
// deliberately omitted -- public.profiles has no such field anywhere in this schema, and fabricating
// one would misrepresent real data as if it existed.
export function DecisionMetadataPanel({ decision }: { decision: WorkforceDecision }) {
  return (
    <div className="qk-card rounded-2xl p-4 w-full">
      <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
        <WorkforceAvatar name={decision.createdByName ?? "Unassigned"} size="lg" />
        <div className="min-w-0">
          <div className="text-[11px] text-muted">Created by</div>
          <div className="text-sm font-semibold text-foreground truncate">{decision.createdByName ?? "Unassigned"}</div>
        </div>
      </div>
      <Row icon={Shield} label="Controlling Stakeholder" value={decision.controllingStakeholderGroup ?? "Not set"} />
      <Row icon={User} label="Decision Owner" value={decision.decisionOwnerName ?? "Unassigned"} />
      <Row icon={Flag} label="Priority" value={decision.priority.charAt(0).toUpperCase() + decision.priority.slice(1)} />
      <Row icon={Calendar} label="Target Date" value={formatDate(decision.targetDate)} />
      <Row icon={Lock} label="Security" value={decision.security.charAt(0).toUpperCase() + decision.security.slice(1)} />
      <Row icon={Clock} label="Current State" value={decision.departmentId ? "Assigned" : "Awaiting audience assignment"} />
    </div>
  );
}
