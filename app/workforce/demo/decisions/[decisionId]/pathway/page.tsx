"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, AlertTriangle } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforcePreviewRole } from "@/components/workforce/demo/RoleContext";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withStageAdvanced } from "@/lib/workforceDemoStore";
import { DECISION, PATHWAY_STAGES, PATHWAY_STAGE_DETAILS, findPerson } from "@/lib/workforceDemo";

// B1: Decision Pathway. Mock-data-driven -- see PATHWAY_STAGE_DETAILS in lib/workforceDemo.ts.
// The current stage index is read from the shared store (not a static prop), so it stays in sync
// with Decision Overview and Department Workspace per the acceptance test: "Advance a qualifying
// stage and verify the new current stage appears across all related role views."
export default function WorkforceDemoPathwayPage({ params }: { params: Promise<{ decisionId: string }> }) {
  const { role } = useWorkforcePreviewRole();
  const { state, update } = useWorkforceDemoStore();
  const canAdvance = role === "enterprise_owner" || role === "decision_owner";

  // Client component -- params must be unwrapped via React.use in this shape, but since this
  // dataset has exactly one real decision, resolve synchronously against the known id instead of
  // adding a use() dependency; an unknown id still 404s.
  void params;
  if (DECISION.id !== "D-2048") notFound();

  return (
    <DemoShell pageType="decision-pathway" searchPlaceholder="Search this decision's pathway…">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Pathway
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Decision Pathway</h1>
            <p className="text-sm text-muted mt-1">Full lifecycle for {DECISION.title}.</p>
          </div>
          {canAdvance && state.decisionStageIndex < PATHWAY_STAGES.length - 1 && (
            <button
              onClick={() => update(withStageAdvanced)}
              className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
            >
              Advance Stage
            </button>
          )}
        </div>

        <div className="space-y-3">
          {PATHWAY_STAGES.map((stage, i) => {
            const detail = PATHWAY_STAGE_DETAILS[i];
            const stageState = i < state.decisionStageIndex ? "done" : i === state.decisionStageIndex ? "active" : "upcoming";
            const owner = findPerson(detail.ownerId);
            return (
              <div key={stage} className={`qk-card rounded-2xl p-4 ${stageState === "active" ? "ring-2 ring-accent-blue" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${stageState === "done" ? "bg-accent-blue text-[#16210a]" : stageState === "active" ? "bg-accent-blue text-[#16210a] ring-4 ring-accent-blue/20" : "bg-surface-2 text-muted"}`}>
                      {stageState === "done" ? <Check size={14} /> : i + 1}
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${stageState === "active" ? "text-accent-blue" : "text-foreground"}`}>{stage}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
                        <WorkforceAvatar name={owner.name} imageUrl={owner.portraitUrl} size="xs" /> {owner.name} · {detail.startDate} → {detail.targetDate}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-foreground tabular-nums">{detail.completionPercent}%</div>
                    <div className="text-[10px] text-muted">Complete</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[11px] text-muted mb-1">Deliverables</div>
                    <ul className="space-y-1">
                      {detail.deliverables.map((d) => (
                        <li key={d} className="flex items-center gap-1.5 text-foreground"><Check size={12} className="text-accent-blue shrink-0" /> {d}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted mb-1">Blockers</div>
                    {detail.blockers.length === 0 ? (
                      <div className="text-muted">None</div>
                    ) : (
                      <ul className="space-y-1">
                        {detail.blockers.map((b) => (
                          <li key={b} className="flex items-center gap-1.5 text-amber-700"><AlertTriangle size={12} className="shrink-0" /> {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {stageState === "active" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border-subtle">
                    <Link href="/workforce/demo/decisions/D-2048/departments/dept_advanced_manufacturing" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Open Stage Workspace</Link>
                    <Link href="/workforce/demo/evidence" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Evidence</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DemoShell>
  );
}
