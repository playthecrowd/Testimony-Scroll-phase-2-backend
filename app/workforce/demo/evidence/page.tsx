"use client";

import Link from "next/link";
import { FileText, ClipboardCheck, Video, Bookmark, Download } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { PATHWAY_STAGES, DECISION_EVIDENCE, SESSION_OUTCOMES, findPerson } from "@/lib/workforceDemo";

const TYPE_ICON = { session_report: ClipboardCheck, recording: Video, artifact: FileText, saved_moment: Bookmark } as const;
const TYPE_LABEL = { session_report: "Session Report", recording: "Recording", artifact: "Artifact", saved_moment: "Saved Moment" } as const;

const OUTCOME_STYLE: Record<string, string> = {
  Ready: "bg-accent-blue/15 text-accent-blue",
  "Follow-up Assigned": "bg-amber-100 text-amber-700",
};

// A6: Evidence & Outcomes Hub. Mock-data-driven -- see DECISION_EVIDENCE in lib/workforceDemo.ts,
// plus **live** shared saved moments read straight from the demo store (not a static copy) -- this
// is what makes the acceptance test work: "Save a moment as Employee, end the session as Manager,
// verify the evidence becomes visible to Department Leader and Approver." Org-wide by design in
// this single-decision dataset (was previously duplicated at /decisions/D-2048/evidence, which now
// redirects here).
export default function WorkforceDemoEvidenceHubPage() {
  const { state } = useWorkforceDemoStore();
  const sharedMoments = state.savedMoments.filter((m) => m.shared);

  return (
    <DemoShell pageType="evidence" searchPlaceholder="Search evidence, sessions, or outcomes…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evidence & Outcomes</h1>
          <p className="text-sm text-muted mt-1">Everything sessions have produced in support of {PATHWAY_STAGES[state.decisionStageIndex]}.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Evidence Items" value={DECISION_EVIDENCE.length + sharedMoments.length} />
          <Stat label="Sessions Contributing" value={1} />
          <Stat label="Success Measures Met" value="2 of 3" />
          <Stat label="Follow-ups Open" value={SESSION_OUTCOMES.filter((o) => o.outcome === "Follow-up Assigned").length} />
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3">
            <h2 className="text-sm font-semibold text-foreground">Evidence Log</h2>
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
              <Download size={12} /> Export Report
            </button>
          </div>
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
                    <Link href="/workforce/demo/manager/sessions/FF-042/archive" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors shrink-0">
                      View Source
                    </Link>
                  )}
                </div>
              );
            })}
            {sharedMoments.map((m) => {
              const p = findPerson(m.personId);
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-9 h-9 rounded-lg bg-accent-gold/10 flex items-center justify-center shrink-0">
                    <Bookmark size={14} className="text-accent-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{m.note}</div>
                    <div className="text-[11px] text-muted">Saved Moment · FF-042 · {m.timestamp}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted shrink-0">
                    <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" /> {p.name}
                  </div>
                  <Link href="/workforce/demo/manager/sessions/FF-042/archive" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors shrink-0">
                    View Source
                  </Link>
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
            <Link href="/workforce/demo/manager/sessions/FF-042/analytics" className="text-xs font-semibold text-accent-blue hover:underline">View Full Session Analytics →</Link>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="qk-card rounded-xl p-3 text-center">
      <div className="text-xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
    </div>
  );
}
