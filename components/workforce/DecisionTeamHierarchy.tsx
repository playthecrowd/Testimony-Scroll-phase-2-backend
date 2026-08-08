import { CheckCircle2, Building2, Landmark, Users2, Lock } from "lucide-react";

function StepRow({
  number,
  icon: Icon,
  title,
  caption,
  state,
  trailing,
}: {
  number: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  caption: string;
  state: "active" | "locked";
  trailing?: React.ReactNode;
}) {
  const active = state === "active";
  return (
    <div className="flex items-start gap-3 py-3">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5 ${
          active ? "bg-accent-blue text-[#16210a]" : "bg-surface-2 text-muted"
        }`}
      >
        {number}
      </span>
      <Icon size={16} className={`mt-1 shrink-0 ${active ? "text-accent-gold" : "text-muted"}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${active ? "text-foreground" : "text-muted"}`}>{title}</div>
        <div className="text-xs text-muted mt-0.5">{caption}</div>
        {trailing && <div className="mt-2">{trailing}</div>}
      </div>
    </div>
  );
}

// The four-step chain-of-command hierarchy (WF-02): who can act at each level, and what's locked
// until an earlier level delegates it. Steps 3/4 are display-only in this phase -- department
// leadership/managers assign those tiers themselves, not the stakeholder directly (matches the
// invitation RLS scope already in place; this component doesn't grant anything new).
export function DecisionTeamHierarchy({ step2Actions }: { step2Actions: React.ReactNode }) {
  return (
    <div className="divide-y divide-border-subtle">
      <StepRow number={1} icon={CheckCircle2} title="Stakeholder Access" caption="Active / Current" state="active" />
      <StepRow number={2} icon={Building2} title="Department & Leadership" caption="Stakeholder can invite" state="active" trailing={step2Actions} />
      <StepRow
        number={3}
        icon={Landmark}
        title="Management"
        caption="Assigned by department leadership"
        state="locked"
        trailing={
          <button disabled className="flex items-center gap-1.5 text-xs text-muted border border-border-subtle rounded-lg px-3 py-1.5 opacity-60 cursor-not-allowed">
            <Lock size={12} /> Invite Management
          </button>
        }
      />
      <StepRow
        number={4}
        icon={Users2}
        title="Job Roles & Employees"
        caption="Assigned by managers"
        state="locked"
        trailing={
          <button disabled className="flex items-center gap-1.5 text-xs text-muted border border-border-subtle rounded-lg px-3 py-1.5 opacity-60 cursor-not-allowed">
            <Lock size={12} /> Invite Job Roles
          </button>
        }
      />
    </div>
  );
}
