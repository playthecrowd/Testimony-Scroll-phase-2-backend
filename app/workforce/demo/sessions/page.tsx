"use client";

import Link from "next/link";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { DECISION, SESSION, SESSION_PROPOSAL, findPerson } from "@/lib/workforceDemo";

const GROUPS = [
  { key: "scheduled", label: "Upcoming" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "needs_attention", label: "Needs Attention" },
] as const;

// A3: Organization Sessions. Mock-data-driven, read-only for leadership -- see acceptance test
// "leadership can inspect FF-042 but cannot perform manager-only live-session actions." No Start,
// End, or Admit controls appear here; those live only on the Manager's own session tree.
export default function WorkforceDemoOrgSessionsPage() {
  const { state } = useWorkforceDemoStore();
  const host = findPerson(SESSION.hostId);
  const activeGroup = state.sessionStatus === "live" ? "live" : state.sessionStatus === "completed" ? "completed" : state.sessionStatus === "cancelled" ? "cancelled" : "scheduled";

  return (
    <DemoShell pageType="org-sessions" searchPlaceholder="Search sessions, decisions, managers…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
          <p className="text-sm text-muted mt-1">Organization-wide session visibility -- read-only.</p>
        </div>

        {GROUPS.map((group) => (
          <div key={group.key}>
            <h2 className="text-sm font-semibold text-foreground mb-3">{group.label}</h2>
            {group.key !== activeGroup ? (
              <div className="qk-card rounded-xl p-5 text-center text-xs text-muted">No sessions in this group right now.</div>
            ) : (
              <div className="qk-card rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted mb-0.5">{SESSION.id} · {DECISION.title} · Advanced Manufacturing</div>
                  <div className="text-sm font-semibold text-foreground">{SESSION.title}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted">
                    <WorkforceAvatar name={host.name} imageUrl={host.portraitUrl} size="xs" /> {host.name} · Sep 18 · 2:00 PM
                  </div>
                </div>
                <div className="text-xs text-muted text-center">
                  <div className="text-foreground font-semibold tabular-nums">{SESSION.invited}</div>
                  invited
                </div>
                <div className="text-xs text-muted text-center">
                  <div className="text-foreground font-semibold tabular-nums">{SESSION.checkedIn}</div>
                  checked in
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{SESSION_PROPOSAL.status === "approved" ? "Approved" : "Awaiting Approval"}</span>
                <div className="flex gap-2 shrink-0">
                  <Link href="/workforce/demo/manager/sessions/FF-042" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Session</Link>
                  <Link href="/workforce/demo/proposals/SP-017" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Proposal</Link>
                  <Link href="/workforce/demo/manager/sessions/FF-042/analytics" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Analytics</Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </DemoShell>
  );
}
