"use client";

import Link from "next/link";
import Image from "next/image";
import { Target, Trophy, BarChart3, FileText, Activity, MapPin, Pencil, MoreHorizontal, X, Shield, User, Flag, Calendar, Lock, Clock } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DecisionAccordion } from "@/components/workforce/DecisionAccordion";
import { ApprovalRoute } from "@/components/workforce/ApprovalRoute";
import { DECISION, OTHER_DECISIONS, SAMPLE_GROUP_IDS, findPerson } from "@/lib/workforceDemo";

// Client component (not a server page with metadata) because it passes lucide-react icon
// components as props into DecisionAccordion/ApprovalRoute, which are themselves client
// components -- passing a component reference as a prop across the server/client boundary isn't
// serializable, whereas passing it within the same client bundle is fine. The existing real
// WorkforceDecisionPreview.tsx avoids this the same way (it's a client component too).

// WF-02: Stakeholder Decision Preview. Mock-data-driven; see lib/workforceDemo.ts. "Track This
// Decision" here is a static link into the Decision Workspace (not a stateful action) since this
// checkpoint has no database to persist tracking against -- matches the "no database dependency"
// instruction for this vertical slice.
export default function WorkforceDemoDecisionPreviewPage() {
  const owner = findPerson(DECISION.createdById);
  const decisionOwner = findPerson(DECISION.decisionOwnerId);

  return (
    <DemoShell pageType="decision-detail" searchPlaceholder="Search decisions, owners, or stakeholders…">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px_300px] gap-6 items-start">
          <div className="space-y-5 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted mb-1">
                  <Link href="/workforce/demo" className="hover:text-accent-blue">Decision Pool</Link> / {DECISION.id}
                </div>
                <h1 className="text-2xl md:text-[28px] font-bold text-foreground leading-tight">{DECISION.title}</h1>
                <div className="mt-2">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue">{DECISION.statusLabel}</span>
                </div>
                <p className="text-sm text-muted mt-2 max-w-xl">{DECISION.executiveIntent}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/workforce/demo/decisions/D-2048/workspace"
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
                >
                  <MapPin size={14} /> Track This Decision
                </Link>
                <button className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                  <Pencil size={14} /> Edit Decision
                </button>
                <button className="p-2.5 rounded-lg border border-border-subtle text-muted hover:text-foreground" aria-label="More actions">
                  <MoreHorizontal size={16} />
                </button>
                <Link href="/workforce/demo" className="p-2.5 rounded-lg border border-border-subtle text-muted hover:text-foreground" aria-label="Close">
                  <X size={16} />
                </Link>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 items-stretch">
              <div className="sm:w-[240px] shrink-0 qk-card rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
                  <WorkforceAvatar name={owner.name} imageUrl={owner.portraitUrl} size="md" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted">Created by</div>
                    <div className="text-sm font-semibold text-foreground truncate">{owner.name}</div>
                    <div className="text-[11px] text-muted truncate">{owner.title}</div>
                  </div>
                </div>
                {[
                  { icon: Shield, label: "Controlling Stakeholder", value: DECISION.controllingStakeholder },
                  { icon: User, label: "Decision Owner", value: decisionOwner.name },
                  { icon: Flag, label: "Priority", value: "Strategic" },
                  { icon: Calendar, label: "Target Date", value: "Oct 24" },
                  { icon: Lock, label: "Security", value: "Internal" },
                  { icon: Clock, label: "Current State", value: "In Department Translation" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-2">
                    <row.icon size={14} className="text-accent-gold mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted">{row.label}</div>
                      <div className="text-xs font-medium text-foreground">{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0 relative rounded-2xl overflow-hidden aspect-[16/9]">
                <Image src={DECISION.heroImageUrl} alt="Future Factory Workforce Readiness" fill className="object-cover" priority />
              </div>
            </div>

            <div className="space-y-3">
              <DecisionAccordion icon={Target} heading="Executive Intent" preview={DECISION.executiveIntent}>
                {DECISION.executiveIntent}
              </DecisionAccordion>
              <DecisionAccordion icon={Trophy} heading="Desired Outcome" preview={DECISION.desiredOutcome}>
                {DECISION.desiredOutcome}
              </DecisionAccordion>
              <DecisionAccordion icon={BarChart3} heading="Success Measures" preview={DECISION.successMeasures}>
                {DECISION.successMeasures}
              </DecisionAccordion>
              <DecisionAccordion icon={FileText} heading={`Supporting Files (${DECISION.supportingFiles.length})`} preview={DECISION.supportingFiles.join(" • ")}>
                <ul className="list-disc pl-4 space-y-1">
                  {DECISION.supportingFiles.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </DecisionAccordion>
              <DecisionAccordion icon={Activity} heading="Activity" preview={DECISION.lastActivity}>
                {DECISION.lastActivity}
              </DecisionAccordion>
            </div>
          </div>

          <div className="qk-card rounded-2xl p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Build the Decision Team</h2>
              <p className="text-xs text-muted mt-0.5">Invite each level through the appropriate reporting chain.</p>
            </div>
            <div className="space-y-3">
              <StepRow n={1} label="Stakeholder Access" sub="Active / Current" done />
              <StepRow n={2} label="Department & Leadership" sub="Stakeholder can invite" action="Invite Departments" />
              <StepRow n={3} label="Management" sub="Assigned by department leadership" locked lockedLabel="Invite Management" />
              <StepRow n={4} label="Job Roles & Employees" sub="Assigned by managers" locked lockedLabel="Invite Job Roles" />
            </div>
            <button className="w-full text-xs font-medium border border-accent-blue text-accent-blue hover:bg-accent-blue/10 rounded-lg px-3 py-1.5 transition-colors">
              Request a Specific Person
            </button>
            <p className="text-[11px] text-muted -mt-2">Requests are routed to the person&apos;s department or manager for approval. Decision leadership is notified.</p>
            <ApprovalRoute />
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">Current Invited Groups</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Advanced Manufacturing", ids: SAMPLE_GROUP_IDS },
                  { label: "Operations", ids: ["maya-chen", "jordan-brooks", "rachel-simmons", "kevin-zhao"] },
                  { label: "Workforce Development", ids: ["maya-patel", "leah-morgan", "nia-coleman", "ava-patel", "marcus-allen"] },
                ].map((group) => (
                  <div key={group.label} className="qk-card rounded-lg p-2 text-center">
                    <div className="flex justify-center -space-x-1.5 mb-1">
                      {group.ids.slice(0, 4).map((id) => {
                        const p = findPerson(id);
                        return <WorkforceAvatar key={id} name={p.name} imageUrl={p.portraitUrl} size="xs" className="ring-2 ring-surface" />;
                      })}
                      {group.ids.length > 4 && (
                        <span className="w-6 h-6 rounded-full bg-surface-2 text-[9px] text-muted flex items-center justify-center ring-2 ring-surface">
                          +{group.ids.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted leading-tight">{group.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted pt-2 border-t border-border-subtle">3 departments invited • 2 leadership responses pending</p>
          </div>

          <aside className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Other Decisions</h2>
              <Link href="/workforce/demo" className="text-xs text-accent-blue hover:underline">View all 32</Link>
            </div>
            <div className="space-y-3">
              {OTHER_DECISIONS.map((d) => (
                <div key={d.id} className="qk-card rounded-xl overflow-hidden">
                  <div className="relative w-full aspect-[16/9]">
                    <Image src={d.thumbnailUrl} alt="" fill className="object-cover" />
                  </div>
                  <div className="p-3">
                    <div className="text-[11px] font-mono text-muted mb-1">{d.id}</div>
                    <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{d.title}</div>
                    <div className="mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted inline-block">{d.status}</div>
                    <div className="text-xs text-foreground mt-2">{d.owner}</div>
                    <div className="text-[11px] text-muted">{d.stakeholder}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </DemoShell>
  );
}

function StepRow({ n, label, sub, done, action, locked, lockedLabel }: { n: number; label: string; sub: string; done?: boolean; action?: string; locked?: boolean; lockedLabel?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${done || (!locked && !done) ? "bg-accent-blue text-[#16210a]" : "bg-surface-2 text-muted"}`}>
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground">{label}</div>
        <div className="text-[11px] text-muted">{sub}</div>
        {action && (
          <button className="mt-1.5 text-xs font-medium border border-accent-blue text-accent-blue hover:bg-accent-blue/10 rounded-lg px-2.5 py-1 transition-colors">
            {action}
          </button>
        )}
        {locked && (
          <button disabled className="mt-1.5 flex items-center gap-1 text-xs font-medium border border-border-subtle text-muted rounded-lg px-2.5 py-1 opacity-60 cursor-not-allowed">
            <Lock size={11} /> {lockedLabel}
          </button>
        )}
      </div>
    </div>
  );
}
