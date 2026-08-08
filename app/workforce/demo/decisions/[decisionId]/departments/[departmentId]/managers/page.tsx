import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DECISION, SELECTED_EXPERIENCE_TITLE, MANAGER_ASSIGNMENTS, findPerson, findDepartment } from "@/lib/workforceDemo";

export const metadata = { title: "Assigned Managers — Plotabl Workforce (Demo)" };

const STATUS_STYLE: Record<string, string> = {
  "Awaiting Assignment": "bg-surface-2 text-muted",
  Assigned: "bg-accent-blue/10 text-accent-blue",
  "Proposal Submitted": "bg-amber-100 text-amber-700",
  "Session Approved": "bg-accent-blue/15 text-accent-blue",
  Delivered: "bg-accent-gold/15 text-accent-gold",
  Complete: "bg-green-100 text-green-700",
};

// B4: Assigned Managers. Mock-data-driven -- a genuine department-management page, distinct from
// (and never reused for) Manager Session Participants, per the explicit ban on that substitution.
export default async function WorkforceDemoAssignedManagersPage({ params }: { params: Promise<{ decisionId: string; departmentId: string }> }) {
  const { departmentId } = await params;
  let department;
  try {
    department = findDepartment(departmentId);
  } catch {
    notFound();
  }
  const navContext = { decisionId: DECISION.id, departmentId: department.id, sessionId: "FF-042" };
  const counts = MANAGER_ASSIGNMENTS.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DemoShell pageType="department-managers" navContext={navContext} searchPlaceholder="Search managers…">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}`} className="hover:text-accent-blue">{department.name} Department</Link> / Assigned Managers
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assigned Managers</h1>
          <p className="text-sm text-muted mt-1">Every manager assigned to translate and deliver {SELECTED_EXPERIENCE_TITLE} for {department.name}.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {["Awaiting Assignment", "Assigned", "Proposal Submitted", "Session Approved", "Delivered", "Complete"].map((s) => (
            <div key={s} className="qk-card rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-foreground tabular-nums">{counts[s] ?? 0}</div>
              <div className="text-[9px] text-muted leading-tight mt-0.5">{s}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {MANAGER_ASSIGNMENTS.map((m) => {
            const p = findPerson(m.personId);
            return (
              <div key={m.personId} className="qk-card rounded-xl p-4 flex flex-wrap items-center gap-3">
                <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="text-[11px] text-muted">{p.title} · Due {m.dueDate}</div>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                <div className="flex gap-2 shrink-0">
                  {m.proposalId && (
                    <Link href={`/workforce/demo/proposals/${m.proposalId}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Proposal</Link>
                  )}
                  {m.sessionId && (
                    <Link href={`/workforce/demo/manager/sessions/${m.sessionId}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Session</Link>
                  )}
                  <button className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                    <MessageSquare size={12} /> Message
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DemoShell>
  );
}
