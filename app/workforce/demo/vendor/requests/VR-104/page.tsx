import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { FULFILLMENT_REQUEST, FULFILLMENT_STAGES, DECISION, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Fulfillment Request VR-104 — Plotabl Workforce (Demo)" };

// Phase 7 / WF-12: Vendor Fulfillment Request. Mock-data-driven -- see lib/workforceDemo.ts.
// Reached from Department Breakout's "Customize with Plotabl" button, which previously had no
// destination. Represents what Plotabl's delivery partner (vendor-qa, "Immersive Systems
// Partner") sees for a custom-build request -- not gated behind the six-role preview switcher,
// since vendor is an external delivery role, not one of the switcher's internal reviewer roles.
export default function WorkforceDemoVendorRequestPage() {
  const vendor = findPerson(FULFILLMENT_REQUEST.vendorId);
  const requestedBy = findPerson(FULFILLMENT_REQUEST.requestedById);

  return (
    <DemoShell
      pageType="vendor-fulfillment"
      searchPlaceholder="Search fulfillment requests…"
      navFooter={
        <Link href="/workforce/demo/decisions/D-2048/workspace" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Track</Link>
      }
    >
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Fulfillment / {FULFILLMENT_REQUEST.id}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{FULFILLMENT_REQUEST.title}</h1>
            <p className="text-sm text-muted mt-1">{FULFILLMENT_REQUEST.experienceTitle} · Custom build request</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue h-fit">{FULFILLMENT_STAGES[FULFILLMENT_REQUEST.currentStageIndex]}</span>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Fulfillment Progress</h2>
          <div className="flex items-center justify-between">
            {FULFILLMENT_STAGES.map((stage, i) => {
              const state = i < FULFILLMENT_REQUEST.currentStageIndex ? "done" : i === FULFILLMENT_REQUEST.currentStageIndex ? "active" : "upcoming";
              return (
                <div key={stage} className="flex items-center gap-1 flex-1">
                  <div className="flex flex-col items-center gap-1.5 text-center min-w-[90px]">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        state === "done" ? "bg-accent-blue text-[#16210a]" : state === "active" ? "bg-accent-blue text-[#16210a] ring-4 ring-accent-blue/20" : "bg-surface-2 text-muted"
                      }`}
                    >
                      {state === "done" ? <Check size={14} /> : i + 1}
                    </span>
                    <span className={`text-[11px] leading-tight ${state === "active" ? "text-accent-blue font-semibold" : "text-muted"}`}>{stage}</span>
                  </div>
                  {i < FULFILLMENT_STAGES.length - 1 && <div className="flex-1 h-px bg-border-subtle" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Request Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <dt className="text-xs text-muted mb-0.5">Delivery Partner</dt>
              <dd className="flex items-center gap-1.5 text-foreground font-medium">
                <WorkforceAvatar name={vendor.name} imageUrl={vendor.portraitUrl} size="xs" /> {vendor.name} · {vendor.title}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-0.5">Requested By</dt>
              <dd className="flex items-center gap-1.5 text-foreground font-medium">
                <WorkforceAvatar name={requestedBy.name} imageUrl={requestedBy.portraitUrl} size="xs" /> {requestedBy.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-0.5">Due Date</dt>
              <dd className="text-foreground font-medium">{FULFILLMENT_REQUEST.dueDate}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-0.5">Linked Decision</dt>
              <dd className="text-foreground font-medium">{DECISION.id} · {DECISION.title}</dd>
            </div>
          </dl>
          <div className="text-xs text-muted mb-1">Scope Notes</div>
          <p className="text-sm text-foreground">{FULFILLMENT_REQUEST.scopeNotes}</p>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Deliverables</h2>
          <ul className="space-y-2.5">
            {FULFILLMENT_REQUEST.deliverables.map((d) => (
              <li key={d.label} className="flex items-center gap-2.5 text-sm">
                {d.done ? <Check size={15} className="text-accent-blue shrink-0" /> : <Circle size={15} className="text-muted shrink-0" />}
                <span className={d.done ? "text-foreground" : "text-muted"}>{d.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
            Advance to QA Review
          </button>
          <button className="text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
            Message Requester
          </button>
        </div>
      </div>
    </DemoShell>
  );
}
