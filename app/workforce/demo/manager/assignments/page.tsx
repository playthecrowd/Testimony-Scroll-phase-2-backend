import Link from "next/link";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { MANAGER_ASSIGNMENTS, findPerson } from "@/lib/workforceDemo";
import { PREVIEW_ROLE_PERSON } from "@/lib/workforcePreviewRole";

export const metadata = { title: "My Assignments — Plotabl Workforce (Demo)" };

const STATUS_STYLE: Record<string, string> = {
  "Awaiting Assignment": "bg-surface-2 text-muted",
  Assigned: "bg-accent-blue/10 text-accent-blue",
  "Proposal Submitted": "bg-amber-100 text-amber-700",
  "Session Approved": "bg-accent-blue/15 text-accent-blue",
  Delivered: "bg-accent-gold/15 text-accent-gold",
  Complete: "bg-green-100 text-green-700",
};

// Manager's own view of MANAGER_ASSIGNMENTS (shared with the department's Assigned Managers
// page, B4) filtered to the active manager identity -- the same assignment made on B4 shows up
// here immediately since both pages read the one array, per B4's acceptance test.
export default function WorkforceDemoMyAssignmentsPage() {
  const managerId = PREVIEW_ROLE_PERSON.manager;
  const mine = MANAGER_ASSIGNMENTS.filter((a) => a.personId === managerId);
  const manager = findPerson(managerId);

  return (
    <DemoShell pageType="manager-assignments" searchPlaceholder="Search your assignments…">
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Assignments</h1>
          <p className="text-sm text-muted mt-1">Department and experience assignments for {manager.name}.</p>
        </div>

        {mine.length === 0 ? (
          <div className="qk-card rounded-xl p-6 text-center text-xs text-muted">No assignments yet.</div>
        ) : (
          <div className="space-y-3">
            {mine.map((a) => (
              <div key={a.personId} className="qk-card rounded-xl p-4 flex flex-wrap items-center gap-3">
                <WorkforceAvatar name={manager.name} imageUrl={manager.portraitUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">Advanced Manufacturing — Future Factory Readiness Simulator</div>
                  <div className="text-[11px] text-muted">Due {a.dueDate}</div>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                <div className="flex gap-2 shrink-0">
                  {a.proposalId && <Link href={`/workforce/demo/proposals/${a.proposalId}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Proposal</Link>}
                  {a.sessionId && <Link href={`/workforce/demo/manager/sessions/${a.sessionId}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Session</Link>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DemoShell>
  );
}
