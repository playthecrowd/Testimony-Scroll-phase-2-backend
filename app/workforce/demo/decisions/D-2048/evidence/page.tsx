import Link from "next/link";
import { FileText, ClipboardCheck, Video, LayoutGrid, GitBranch, Users, MessageSquare } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DECISION, PATHWAY_STAGES, DECISION_EVIDENCE, SESSION_OUTCOMES, findPerson, findDepartment } from "@/lib/workforceDemo";

export const metadata = { title: "Evidence & Outcomes — Plotabl Workforce (Demo)" };

const TYPE_ICON = { session_report: ClipboardCheck, recording: Video, artifact: FileText } as const;
const TYPE_LABEL = { session_report: "Session Report", recording: "Recording", artifact: "Artifact" } as const;

const OUTCOME_STYLE: Record<string, string> = {
  Ready: "bg-accent-blue/15 text-accent-blue",
  "Follow-up Assigned": "bg-amber-100 text-amber-700",
};

// WF-11: Evidence & Outcomes. Mock-data-driven -- see lib/workforceDemo.ts. This is where Session
// Analytics' and Recordings & Archive's "Add to Decision Evidence" actions both point -- the
// decision-level aggregation of what each session produced, closing the loop the build spec
// described as "progress returned to leadership." Reuses SESSION_OUTCOMES (the same three
// employees shown on Session Analytics) rather than fabricating a separate roster.
export default function WorkforceDemoEvidencePage() {
  const department = findDepartment(DECISION.departmentId);

  return (
    <DemoShell
      pageType="decision-evidence"
      searchPlaceholder="Search this decision, evidence, or outcomes…"
      nav={
        <>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Decision Workspace</div>
          <DemoNavItem href="/workforce/demo/decisions/D-2048/workspace" label="Decision Overview" icon={LayoutGrid} />
          <DemoNavItem href="/workforce/demo/decisions/D-2048/workspace" label="Pathway" icon={GitBranch} />
          <DemoNavItem href={`/workforce/demo/decisions/D-2048/departments/${department.id}`} label="Department Breakouts" icon={Users} />
          <DemoNavItem href="/workforce/demo/decisions/D-2048/workspace" label="Feedback" icon={MessageSquare} />
          <DemoNavItem href="/workforce/demo/decisions/D-2048/evidence" label="Evidence & Outcomes" active icon={ClipboardCheck} />
        </>
      }
      navFooter={
        <Link href="/workforce/demo" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Pool</Link>
      }
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Evidence & Outcomes
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evidence & Outcomes</h1>
          <p className="text-sm text-muted mt-1">Everything sessions have produced in support of {PATHWAY_STAGES[DECISION.currentStageIndex]}.</p>
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground p-4 pb-3">Evidence Log</h2>
          <div className="divide-y divide-border-subtle">
            {DECISION_EVIDENCE.map((item) => {
              const Icon = TYPE_ICON[item.type];
              const addedBy = findPerson(item.addedById);
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-9 h-9 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-accent-blue" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="text-[11px] text-muted flex items-center gap-1.5">
                      <span className="font-medium">{TYPE_LABEL[item.type]}</span> · Supports {PATHWAY_STAGES[item.stageIndex]}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted shrink-0">
                    <WorkforceAvatar name={addedBy.name} imageUrl={addedBy.portraitUrl} size="xs" /> {addedBy.name}
                  </div>
                  {item.sourceSessionId && (
                    <Link href="/workforce/demo/sessions/FF-042/archive" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors shrink-0">
                      View Source
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground p-4 pb-0">Employee Outcomes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-3">
              <thead>
                <tr className="text-left text-muted border-b border-border-subtle">
                  <th className="font-medium py-2 px-4">Employee</th>
                  <th className="font-medium py-2 px-2">Role</th>
                  <th className="font-medium py-2 px-2">Completion</th>
                  <th className="font-medium py-2 px-2">Readiness</th>
                  <th className="font-medium py-2 px-4">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {SESSION_OUTCOMES.map((row) => {
                  const p = findPerson(row.personId);
                  return (
                    <tr key={row.personId} className="border-b border-border-subtle last:border-0">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                          <span className="text-foreground font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-foreground">{row.role}</td>
                      <td className="py-2.5 px-2 text-foreground tabular-nums">{row.completion}%</td>
                      <td className="py-2.5 px-2 text-foreground tabular-nums">{row.readiness}%</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${OUTCOME_STYLE[row.outcome]}`}>{row.outcome}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border-subtle">
            <Link href="/workforce/demo/sessions/FF-042/analytics" className="text-xs font-semibold text-accent-blue hover:underline">View Full Session Analytics →</Link>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
