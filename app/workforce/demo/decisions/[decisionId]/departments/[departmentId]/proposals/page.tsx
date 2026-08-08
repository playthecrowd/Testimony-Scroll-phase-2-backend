"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { WorkforceDemoProposalStatus } from "@/lib/workforceDemoStore";
import { DECISION, SESSION_PROPOSAL, findPerson, findDepartment } from "@/lib/workforceDemo";

const GROUPS: { key: WorkforceDemoProposalStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending Approval" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

// B5: Department Proposals. Mock-data-driven, reads `proposalStatus` live from the shared store
// (not a static field) so approving SP-017 elsewhere moves it into the right group here
// immediately -- a genuine department-management page, never a substitute for Manager Live
// Control.
export default function WorkforceDemoDepartmentProposalsPage({ params }: { params: Promise<{ decisionId: string; departmentId: string }> }) {
  const { state } = useWorkforceDemoStore();
  void params;
  let department;
  try {
    department = findDepartment("dept_advanced_manufacturing");
  } catch {
    notFound();
  }
  const requestedBy = findPerson(SESSION_PROPOSAL.requestedById);

  return (
    <DemoShell pageType="department-proposals" searchPlaceholder="Search proposals…">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}`} className="hover:text-accent-blue">{department.name} Department</Link> / Proposals
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Department Proposals</h1>
          <p className="text-sm text-muted mt-1">Every session proposal connected to {department.name}.</p>
        </div>

        {GROUPS.map((group) => (
          <div key={group.key}>
            <h2 className="text-sm font-semibold text-foreground mb-3">{group.label}</h2>
            {state.proposalStatus !== group.key ? (
              <div className="qk-card rounded-xl p-4 text-center text-xs text-muted">No proposals in this group.</div>
            ) : (
              <Link href="/workforce/demo/proposals/SP-017" className="qk-card rounded-xl p-4 flex flex-wrap items-center gap-3 hover:border-accent-blue/50 transition-colors block">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted mb-0.5">{SESSION_PROPOSAL.id}</div>
                  <div className="text-sm font-semibold text-foreground">{SESSION_PROPOSAL.experienceTitle}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                    <WorkforceAvatar name={requestedBy.name} imageUrl={requestedBy.portraitUrl} size="xs" /> {requestedBy.name} · {SESSION_PROPOSAL.proposedDate}
                  </div>
                </div>
                <div className="text-xs text-muted">{SESSION_PROPOSAL.participantIds.length} participants</div>
                <div className="text-xs text-muted">{SESSION_PROPOSAL.creditsRequired} credits</div>
              </Link>
            )}
          </div>
        ))}
      </div>
    </DemoShell>
  );
}
