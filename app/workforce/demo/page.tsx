import Link from "next/link";
import Image from "next/image";
import { LayoutList } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DECISION, OTHER_DECISIONS, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Decision Pool — Plotabl Workforce (Demo)" };

// WF-01: Decision Pool Catalog. Mock-data-driven -- see lib/workforceDemo.ts. Only D-2048 links to
// a fully built detail page in this checkpoint; the other cards from the build spec's 32-decision
// list are shown for visual density/scroll but are display-only (documented scope decision, not an
// oversight -- see the build report).
export default function WorkforceDemoPoolPage() {
  const owner = findPerson(DECISION.createdById);

  return (
    <DemoShell pageType="decision-pool" searchPlaceholder="Search decisions, owners, or stakeholders…">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-foreground">Decision Pool</h1>
            <p className="text-sm text-muted mt-1">Track decisions from stakeholder intent through workforce implementation.</p>
            <p className="text-xs text-muted mt-1">{OTHER_DECISIONS.length + 1} active decisions shown</p>
          </div>
          <button className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
            <LayoutList size={15} /> New Decision
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/workforce/demo/decisions/D-2048"
            className="qk-card rounded-xl overflow-hidden block hover:border-accent-blue/50 transition-colors group ring-2 ring-accent-blue/40"
          >
            <div className="relative w-full aspect-[4/3]">
              <Image src={DECISION.thumbnailUrl} alt="" fill className="object-cover" />
            </div>
            <div className="p-3">
              <div className="text-[11px] font-mono text-muted mb-1">{DECISION.id}</div>
              <div className="text-sm font-semibold text-foreground leading-snug group-hover:text-accent-blue transition-colors">{DECISION.title}</div>
              <div className="mt-2 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">
                {DECISION.statusLabel}
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                <WorkforceAvatar name={owner.name} imageUrl={owner.portraitUrl} size="xs" />
                <span className="text-xs text-foreground truncate">{owner.name}</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">{DECISION.controllingStakeholder}</div>
              <div className="mt-2.5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full bg-accent-blue rounded-full" style={{ width: `${DECISION.progressPercent}%` }} />
              </div>
            </div>
          </Link>

          {OTHER_DECISIONS.map((d) => (
            <div key={d.id} className="qk-card rounded-xl overflow-hidden">
              <div className="relative w-full aspect-[4/3]">
                <Image src={d.thumbnailUrl} alt="" fill className="object-cover" />
              </div>
              <div className="p-3">
                <div className="text-[11px] font-mono text-muted mb-1">{d.id}</div>
                <div className="text-sm font-semibold text-foreground leading-snug">{d.title}</div>
                <div className="mt-2 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted">{d.status}</div>
                <div className="text-xs text-foreground mt-2.5">{d.owner}</div>
                <div className="text-[11px] text-muted mt-0.5">{d.stakeholder}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoShell>
  );
}
