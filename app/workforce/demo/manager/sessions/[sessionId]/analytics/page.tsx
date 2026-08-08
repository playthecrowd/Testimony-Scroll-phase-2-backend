"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Share2, ClipboardCheck } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { DECISION, SESSION, SESSION_ANALYTICS, SESSION_OUTCOMES, findPerson } from "@/lib/workforceDemo";

const OUTCOME_STYLE: Record<string, string> = {
  Ready: "bg-accent-blue/15 text-accent-blue",
  "Follow-up Assigned": "bg-amber-100 text-amber-700",
};

// C8: Manager Session Analytics. Mock-data-driven, session-scoped (migrated from the fixed
// /sessions/FF-042/analytics). Checkpoint completion reads live from the shared store, so
// completing a checkpoint as Employee (D2's "Complete Checkpoint") shows up here immediately --
// the acceptance test this page is built to satisfy. Leadership roles reach this same page
// read-only (no admin controls exist here regardless of role, so nothing extra to gate).
export default function WorkforceDemoManagerAnalyticsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state } = useWorkforceDemoStore();
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell pageType="manager-analytics" searchPlaceholder="Search sessions, participants, decisions…">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Sessions / {SESSION.id} / Analytics
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Session Analytics</h1>
            <p className="text-sm text-muted mt-1">{SESSION.title} · {SESSION.id} · Manager: {host.name}</p>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue capitalize">{state.sessionStatus.replace("_", " ")}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Download size={13} /> Export Report</button>
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Share2 size={13} /> Share with Department Leadership</button>
            <Link href="/workforce/demo/evidence" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><ClipboardCheck size={13} /> Add to Decision Evidence</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Invited", value: SESSION_ANALYTICS.invited },
            { label: "Attended", value: SESSION_ANALYTICS.attended },
            { label: "Checkpoints Complete", value: `${state.checkpointsCompleted} of ${state.totalCheckpoints}` },
            { label: "Avg Understanding", value: `${SESSION_ANALYTICS.avgUnderstanding}%` },
            { label: "Readiness Confidence", value: `${SESSION_ANALYTICS.readinessConfidence}%` },
            { label: "Archived Moments", value: state.savedMoments.length },
          ].map((s) => (
            <div key={s.label} className="qk-card rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-foreground tabular-nums">{s.value}</div>
              <div className="text-[10px] text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground p-4 pb-0">Employee Outcomes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-3">
              <thead>
                <tr className="text-left text-muted border-b border-border-subtle">
                  <th className="font-medium py-2 px-4">Employee</th>
                  <th className="font-medium py-2 px-2">Role</th>
                  <th className="font-medium py-2 px-2">Attendance</th>
                  <th className="font-medium py-2 px-2">Completion</th>
                  <th className="font-medium py-2 px-2">Assessment Score</th>
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
                      <td className="py-2.5 px-2 text-foreground">{row.attendance}</td>
                      <td className="py-2.5 px-2 text-foreground tabular-nums">{row.completion}%</td>
                      <td className="py-2.5 px-2 text-foreground tabular-nums">{row.assessmentScore}%</td>
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
        </div>
      </div>
    </DemoShell>
  );
}
