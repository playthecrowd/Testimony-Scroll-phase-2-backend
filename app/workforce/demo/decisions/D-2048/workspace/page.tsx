"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Sparkles, ChevronRight } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { DECISION, PATHWAY_STAGES, PATHWAY_STAGE_DETAILS, SELECTED_EXPERIENCE_TITLE, EXPERIENCE_USE_CASES, DECISION_FEEDBACK, SAMPLE_GROUP_IDS, findPerson, findDepartment } from "@/lib/workforceDemo";

const PROPOSAL_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Awaiting Leadership Approval",
  changes_requested: "Changes Requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// WF-03: Decision Workspace Tracking. Mock-data-driven -- see lib/workforceDemo.ts. Current stage
// and the SP-017 status badge read live from the shared store (not the static DECISION record),
// so this stays in sync with the standalone Pathway page and Proposal Detail after "Advance
// Stage" or an approval decision -- the exact consistency the acceptance tests require.
export default function WorkforceDemoWorkspacePage() {
  const { state } = useWorkforceDemoStore();
  const department = findDepartment(DECISION.departmentId);
  const recommended = EXPERIENCE_USE_CASES.find((e) => e.title === SELECTED_EXPERIENCE_TITLE)!;
  const stageIndex = state.decisionStageIndex;
  const stageDetail = PATHWAY_STAGE_DETAILS[stageIndex];
  const proposalLabel = PROPOSAL_LABEL[state.proposalStatus];

  return (
    <DemoShell
      pageType="decision-workspace"
      searchPlaceholder="Search this decision, people, sessions, or evidence…"
      navFooter={
        <Link href="/workforce/demo" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Pool</Link>
      }
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted mb-1">
              <Link href="/workforce/demo" className="hover:text-accent-blue">Decision Pool</Link> / {DECISION.id}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{DECISION.title}</h1>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue">● {PATHWAY_STAGES[stageIndex]}</span>
          </div>
          <Link href="/workforce/demo/proposals/new" className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
            Propose Session
          </Link>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
            {PATHWAY_STAGES.map((stage, i) => {
              const state2 = i < stageIndex ? "done" : i === stageIndex ? "active" : "upcoming";
              return (
                <div key={stage} className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-center gap-1 min-w-[92px] text-center">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        state2 === "done" ? "bg-accent-blue text-[#16210a]" : state2 === "active" ? "bg-accent-blue text-[#16210a] ring-4 ring-accent-blue/20" : "bg-surface-2 text-muted"
                      }`}
                    >
                      {state2 === "done" ? <Check size={14} /> : i + 1}
                    </span>
                    <span className={`text-[11px] leading-tight ${state2 === "active" ? "text-accent-blue font-semibold" : "text-muted"}`}>{stage}</span>
                    {state2 === "active" && <span className="text-[10px] text-accent-blue">Decision currently here</span>}
                  </div>
                  {i < PATHWAY_STAGES.length - 1 && <ChevronRight size={14} className="text-border-subtle shrink-0" />}
                </div>
              );
            })}
            <div className="ml-auto text-right shrink-0 pl-4">
              <div className="text-2xl font-bold text-foreground">{Math.round(((stageIndex + stageDetail.completionPercent / 100) / PATHWAY_STAGES.length) * 100)}%</div>
              <div className="text-[11px] text-muted">Progress</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="qk-card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Current Stage: {PATHWAY_STAGES[stageIndex]}</h2>
            <div className="text-xs text-muted mb-3">{stageDetail.completionPercent}% complete</div>
            <div className="text-[11px] text-muted mb-1">Assigned Group</div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-1.5">
                {SAMPLE_GROUP_IDS.map((id) => {
                  const p = findPerson(id);
                  return <WorkforceAvatar key={id} name={p.name} imageUrl={p.portraitUrl} size="sm" className="ring-2 ring-surface" />;
                })}
              </div>
              <span className="text-xs text-foreground">{department.name} Leadership</span>
            </div>
            <div className="text-[11px] text-muted mb-1.5">Deliverables</div>
            <ul className="text-xs text-foreground space-y-1.5 mb-4">
              {stageDetail.deliverables.map((d) => (
                <li key={d} className="flex items-center gap-1.5"><Check size={13} className="text-accent-blue" /> {d}</li>
              ))}
            </ul>
            <Link
              href={`/workforce/demo/decisions/D-2048/departments/${department.id}`}
              className="block text-center text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
            >
              Open Stage Workspace
            </Link>
          </div>

          <div className="qk-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={14} className="text-accent-gold" />
              <h2 className="text-sm font-semibold text-foreground">Recommended Experience Opportunity</h2>
            </div>
            <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3">
              <Image src={DECISION.thumbnailUrl} alt={recommended.title} fill className="object-cover" />
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-accent-gold mb-1">{recommended.capability}</div>
            <div className="text-sm font-semibold text-foreground mb-1">{recommended.title}</div>
            <div className="text-xs text-muted mb-3">{recommended.description}</div>
            <div className="flex gap-2">
              <button className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Preview Experience</button>
              <Link
                href={`/workforce/demo/decisions/D-2048/departments/${department.id}`}
                className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
              >
                Propose Session
              </Link>
            </div>
          </div>

          <div className="qk-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground">Session Proposal SP-017</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{proposalLabel}</span>
            </div>
            <dl className="text-xs space-y-1.5 mb-4">
              <Row label="Experience" value="Future Factory Readiness Simulator" />
              <Row label="Requested by" value="Jordan Brooks · Operations Manager" />
              <Row label="Date" value="Sep 18 · 2:00 PM" />
              <Row label="Participants" value="24 invited" />
              <Row label="Funding" value="Host covers 120 credits" />
            </dl>
            <div className="flex gap-2">
              <Link
                href="/workforce/demo/proposals/SP-017"
                className="flex-1 text-center text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"
              >
                Review Proposal
              </Link>
              <Link
                href="/workforce/demo/proposals/SP-017"
                className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
              >
                Approve Proposal
              </Link>
            </div>
            <p className="text-[10px] text-muted mt-2">This proposal must be approved by the decision&apos;s authorized leadership before participants are invited.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">People & Roles</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><div className="text-lg font-bold text-foreground">3</div><div className="text-[10px] text-muted">Stakeholders</div></div>
              <div><div className="text-lg font-bold text-foreground">4</div><div className="text-[10px] text-muted">Dept. Leads</div></div>
              <div><div className="text-lg font-bold text-foreground">{DECISION.audience.managers}</div><div className="text-[10px] text-muted">Managers</div></div>
              <div><div className="text-lg font-bold text-foreground">{DECISION.audience.employees}</div><div className="text-[10px] text-muted">Employees</div></div>
            </div>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Live Feedback</h3>
              <Link href="/workforce/demo/decisions/D-2048/feedback" className="text-xs text-accent-blue hover:underline">View All →</Link>
            </div>
            <div className="space-y-2.5">
              {DECISION_FEEDBACK.slice(0, 2).map((f, i) => {
                const p = findPerson(f.personId);
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground">{f.body}</div>
                      <div className="text-[10px] text-muted">{p.name} · {f.timeAgo}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Decision Health</h3>
            <div className="space-y-2.5">
              <HealthBar label="Understanding" value={82} />
              <HealthBar label="Participation" value={71} />
            </div>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground font-medium text-right">{value}</dd>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-foreground font-medium">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full bg-accent-blue rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
