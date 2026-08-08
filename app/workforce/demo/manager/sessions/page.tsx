"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { WorkforceDemoSessionStatus } from "@/lib/workforceDemoStore";
import { DECISION, SESSION, findPerson } from "@/lib/workforceDemo";

const GROUPS: { key: WorkforceDemoSessionStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending Approval" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "onboarding", label: "Onboarding" },
  { key: "ready", label: "Ready" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

// C1: Manager All Sessions. Mock-data-driven, reads sessionStatus live from the shared store so
// FF-042 moves between groups as the Manager starts/ends it. "Onboarding" always preserves the
// session id (FF-042) and opens /manager/sessions/FF-042/onboarding, per the acceptance test.
export default function WorkforceDemoManagerAllSessionsPage() {
  const { state } = useWorkforceDemoStore();
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell pageType="manager-all-sessions" searchPlaceholder="Search your sessions…">
      <div className="max-w-[1300px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Sessions</h1>
            <p className="text-sm text-muted mt-1">Every session you manage or facilitate.</p>
          </div>
          <Link href="/workforce/demo/proposals/new" className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
            Create Session Proposal
          </Link>
        </div>

        {GROUPS.map((group) => (
          <div key={group.key}>
            <h2 className="text-sm font-semibold text-foreground mb-3">{group.label}</h2>
            {state.sessionStatus !== group.key ? (
              <div className="qk-card rounded-xl p-4 text-center text-xs text-muted">No sessions in this group.</div>
            ) : (
              <div className="qk-card rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted mb-0.5">{SESSION.id} · {DECISION.title} · Advanced Manufacturing</div>
                  <div className="text-sm font-semibold text-foreground">{SESSION.title}</div>
                  <div className="text-xs text-muted mt-0.5">{host.name} · Sep 18 · 2:00 PM</div>
                </div>
                <Stat label="Invited" value={SESSION.invited} />
                <Stat label="Checked In" value={SESSION.checkedIn} />
                <Stat label="Admitted" value={Object.values(state.invitations).filter((i) => i.admitted).length} />
                <div className="text-xs text-muted text-center">
                  <div className="text-foreground font-semibold tabular-nums">{Math.round((state.checkpointsCompleted / state.totalCheckpoints) * 100)}%</div>
                  onboarding
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Users size={12} /> {host.name}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href="/workforce/demo/manager/sessions/FF-042" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Session</Link>
                  <Link href="/workforce/demo/manager/sessions/FF-042/onboarding" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Onboarding</Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </DemoShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-xs text-muted text-center">
      <div className="text-foreground font-semibold tabular-nums">{value}</div>
      {label}
    </div>
  );
}
