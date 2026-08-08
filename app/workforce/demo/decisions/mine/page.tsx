"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Users, ClipboardCheck } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforcePreviewRole } from "@/components/workforce/demo/RoleContext";
import { DECISION, OTHER_DECISIONS, findPerson } from "@/lib/workforceDemo";

// A1: My Decisions. Mock-data-driven -- see lib/workforceDemo.ts. Role-scoped: Enterprise Owner
// sees every decision org-wide; Decision Owner (Maya Chen) sees only decisions she actually owns
// (D-2048.decisionOwnerId === "maya-chen") -- the 6 OTHER_DECISIONS stub cards have no real
// owner-person mapping in this dataset, so they only appear for the Enterprise Owner's org-wide
// view, never misattributed to Maya Chen.
const NEEDS_ACTION_STATUSES = ["Stakeholder Review", "In Translation"];

export default function WorkforceDemoMyDecisionsPage() {
  const { role } = useWorkforcePreviewRole();
  const owner = findPerson(DECISION.createdById);
  const showAll = role === "enterprise_owner";
  const showMine = role === "decision_owner";
  const visible = showAll || showMine;

  const needsAction = showAll ? OTHER_DECISIONS.filter((d) => NEEDS_ACTION_STATUSES.includes(d.status)) : [];
  const active = showAll ? OTHER_DECISIONS.filter((d) => !NEEDS_ACTION_STATUSES.includes(d.status)) : [];

  return (
    <DemoShell pageType="decision-mine" searchPlaceholder="Search decisions, owners, or stakeholders…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Decisions</h1>
          <p className="text-sm text-muted mt-1">
            {showAll ? "Every decision across the organization." : "Decisions you own, created, sponsor, or control."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input disabled placeholder="Search by title, owner, stakeholder, or ID" className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-xs focus-ring" />
          </div>
          {["Stage", "Priority", "Department", "Health", "Target Date"].map((f) => (
            <button key={f} disabled className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-muted cursor-not-allowed">{f}</button>
          ))}
        </div>

        {!visible && (
          <div className="qk-card rounded-2xl p-8 text-center">
            <p className="text-sm text-muted">This role doesn&apos;t own or sponsor any decisions. Switch to Enterprise Owner or Decision Owner to preview this page.</p>
          </div>
        )}

        {visible && (
          <>
            <Section title="Needs Action" empty={needsAction.length === 0 && !showMine}>
              {showMine && (
                <DecisionCard id={DECISION.id} title={DECISION.title} thumbnailUrl={DECISION.thumbnailUrl} statusLabel={DECISION.statusLabel} owner={owner} stakeholder={DECISION.controllingStakeholder} progress={DECISION.progressPercent} priority="Strategic" targetDate="Oct 24" departmentCount={3} peopleCount={97} health="On Track" href="/workforce/demo/decisions/D-2048" />
              )}
              {needsAction.map((d) => (
                <StubDecisionCard key={d.id} {...d} />
              ))}
            </Section>

            <Section title="Active" empty={active.length === 0 && showMine}>
              {active.map((d) => (
                <StubDecisionCard key={d.id} {...d} />
              ))}
            </Section>

            <Section title="Completed" empty>
              <></>
            </Section>

            <Section title="Archived" empty>
              <></>
            </Section>
          </>
        )}
      </div>
    </DemoShell>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-3">{title}</h2>
      {empty ? (
        <div className="qk-card rounded-xl p-6 text-center text-xs text-muted">No decisions in this group right now.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
      )}
    </div>
  );
}

function DecisionCard({
  id, title, thumbnailUrl, statusLabel, owner, stakeholder, progress, priority, targetDate, departmentCount, peopleCount, health, href,
}: {
  id: string; title: string; thumbnailUrl: string; statusLabel: string;
  owner: ReturnType<typeof findPerson>; stakeholder: string; progress: number;
  priority: string; targetDate: string; departmentCount: number; peopleCount: number; health: string; href: string;
}) {
  return (
    <Link href={href} className="qk-card rounded-xl overflow-hidden block hover:border-accent-blue/50 transition-colors group ring-2 ring-accent-blue/40">
      <div className="relative w-full aspect-[4/3]">
        <Image src={thumbnailUrl} alt="" fill className="object-cover" />
      </div>
      <div className="p-3">
        <div className="text-[11px] font-mono text-muted mb-1">{id}</div>
        <div className="text-sm font-semibold text-foreground leading-snug group-hover:text-accent-blue transition-colors">{title}</div>
        <div className="mt-2 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">{statusLabel}</div>
        <div className="flex items-center gap-1.5 mt-2.5">
          <WorkforceAvatar name={owner.name} imageUrl={owner.portraitUrl} size="xs" />
          <span className="text-xs text-foreground truncate">{owner.name}</span>
        </div>
        <div className="text-[11px] text-muted mt-0.5">{stakeholder}</div>
        <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-[10px] text-muted">
          <span className="flex items-center gap-1"><Users size={10} /> {departmentCount} depts</span>
          <span>{peopleCount} people</span>
          <span className="flex items-center gap-1"><ClipboardCheck size={10} /> {health}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted mt-1.5">
          <span>{priority} · Due {targetDate}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent-blue rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  );
}

function StubDecisionCard({ id, title, status, owner, stakeholder, thumbnailUrl }: (typeof OTHER_DECISIONS)[number]) {
  return (
    <div className="qk-card rounded-xl overflow-hidden">
      <div className="relative w-full aspect-[4/3]">
        <Image src={thumbnailUrl} alt="" fill className="object-cover" />
      </div>
      <div className="p-3">
        <div className="text-[11px] font-mono text-muted mb-1">{id}</div>
        <div className="text-sm font-semibold text-foreground leading-snug">{title}</div>
        <div className="mt-2 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted">{status}</div>
        <div className="text-xs text-foreground mt-2.5">{owner}</div>
        <div className="text-[11px] text-muted mt-0.5">{stakeholder}</div>
      </div>
    </div>
  );
}
