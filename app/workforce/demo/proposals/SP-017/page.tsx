"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X, MessageSquareWarning, LayoutGrid, ListChecks, UserCheck, Calendar as CalendarIcon, Compass, Users, ClipboardCheck } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforcePreviewRole } from "@/components/workforce/demo/RoleContext";
import { DECISION, SESSION_PROPOSAL, findPerson } from "@/lib/workforceDemo";

// SP-02: Session Proposal Detail / Approval. Client component (not server-fetched metadata) since
// it needs the active preview role to decide which actions to show -- Approve/Request Changes/
// Reject only make sense for Department Leader or Approver; Manager sees a read-only submitted
// view instead, matching the spec's "only authorized leadership may see approval controls" rule.
export default function ProposalDetailPage() {
  const { role } = useWorkforcePreviewRole();
  const router = useRouter();
  const [status, setStatus] = useState(SESSION_PROPOSAL.status);
  const requestedBy = findPerson(SESSION_PROPOSAL.requestedById);
  const canDecide = role === "department_leader" || role === "approver";

  function decide(next: "approved" | "changes_requested" | "rejected") {
    setStatus(next);
    if (next === "approved") {
      router.push("/workforce/demo/proposals/SP-017/confirmed");
    }
  }

  return (
    <DemoShell
      pageType="proposal-detail"
      searchPlaceholder="Search decisions, people, experiences…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo" label="Decision Pool" icon={LayoutGrid} />
          <DemoNavItem href="/workforce/demo" label="My Decisions" icon={ListChecks} />
          <DemoNavItem href="/workforce/demo" label="Assigned to Me" icon={UserCheck} />
          <DemoNavItem href="/workforce/demo" label="Sessions" icon={CalendarIcon} />
          <DemoNavItem href="/workforce/demo" label="Attractions" icon={Compass} />
          <DemoNavItem href="/workforce/demo" label="People & Teams" icon={Users} />
          <DemoNavItem href="/workforce/demo/decisions/D-2048/evidence" label="Evidence & Outcomes" icon={ClipboardCheck} />
        </>
      }
      navFooter={
        <Link href="/workforce/demo/decisions/D-2048/workspace" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Track</Link>
      }
    >
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Proposals / {SESSION_PROPOSAL.id}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Session Proposal {SESSION_PROPOSAL.id}</h1>
            <p className="text-sm text-muted mt-1">{SESSION_PROPOSAL.experienceTitle}</p>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Proposal Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Row label="Experience" value={SESSION_PROPOSAL.experienceTitle} />
            <Row
              label="Requested by"
              value={
                <span className="flex items-center gap-1.5">
                  <WorkforceAvatar name={requestedBy.name} imageUrl={requestedBy.portraitUrl} size="xs" /> {requestedBy.name}
                </span>
              }
            />
            <Row label="Date & Time" value={`${SESSION_PROPOSAL.proposedDate} · ${SESSION_PROPOSAL.proposedTime}`} />
            <Row label="Duration" value={`${SESSION_PROPOSAL.durationMinutes} min`} />
            <Row label="Participants" value={`${SESSION_PROPOSAL.participantIds.length} selected`} />
            <Row label="Funding" value={`Host covers ${SESSION_PROPOSAL.creditsRequired} credits`} />
          </dl>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Selected Participants</h2>
          <div className="flex flex-wrap gap-2">
            {SESSION_PROPOSAL.participantIds.map((id) => {
              const p = findPerson(id);
              return (
                <span key={id} className="flex items-center gap-1.5 text-xs bg-surface-2 rounded-full pl-1 pr-2.5 py-1">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" /> {p.name}
                </span>
              );
            })}
          </div>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Approval Route</h2>
          <div className="flex items-center justify-between">
            {SESSION_PROPOSAL.approvalSteps.map((step, i) => {
              const p = findPerson(step.byId);
              return (
                <div key={step.label} className="flex items-center gap-1 flex-1">
                  <div className="flex flex-col items-center gap-1.5 text-center min-w-[90px]">
                    <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="md" className={step.done ? "" : "opacity-50"} />
                    <span className={`text-[11px] leading-tight ${step.done ? "text-foreground font-medium" : "text-muted"}`}>{step.label}</span>
                    <span className="text-[10px] text-muted">{step.date ?? "Pending"}</span>
                  </div>
                  {i < SESSION_PROPOSAL.approvalSteps.length - 1 && <div className="flex-1 h-px bg-border-subtle" />}
                </div>
              );
            })}
          </div>
        </div>

        {canDecide && status === "pending_approval" && (
          <div className="qk-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Approval Decision</h2>
            <p className="text-xs text-muted mb-4">You&apos;re previewing as {role === "department_leader" ? "Department Leader" : "Approver / Executive"} — this decision is visible to your role.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => decide("approved")} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
                <Check size={14} /> Approve
              </button>
              <button onClick={() => decide("changes_requested")} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                <MessageSquareWarning size={14} /> Request Changes
              </button>
              <button onClick={() => decide("rejected")} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        )}

        {!canDecide && status === "pending_approval" && (
          <p className="text-xs text-muted">Only Department Leadership or an Approver can decide this proposal. Switch roles above to preview that view.</p>
        )}

        {status === "changes_requested" && (
          <div className="qk-card rounded-2xl p-5 border-amber-200 bg-amber-50/50">
            <p className="text-sm text-amber-800">Changes were requested. The manager should revise and resubmit this proposal.</p>
            <Link href="/workforce/demo/proposals/new" className="inline-block mt-3 text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
              Revise Proposal
            </Link>
          </div>
        )}

        {status === "rejected" && (
          <div className="qk-card rounded-2xl p-5 border-red-200 bg-red-50/50">
            <p className="text-sm text-red-700">This proposal was rejected.</p>
            <Link href="/workforce/demo/decisions/D-2048/departments/dept_advanced_manufacturing" className="inline-block mt-3 text-xs font-semibold px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
              Back to Session Proposals
            </Link>
          </div>
        )}
      </div>
    </DemoShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted mb-0.5">{label}</dt>
      <dd className="text-foreground font-medium">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: typeof SESSION_PROPOSAL.status }) {
  const style: Record<typeof status, string> = {
    draft: "bg-surface-2 text-muted",
    pending_approval: "bg-amber-100 text-amber-700",
    changes_requested: "bg-amber-100 text-amber-700",
    resubmitted: "bg-amber-100 text-amber-700",
    approved: "bg-accent-blue/15 text-accent-blue",
    rejected: "bg-red-100 text-red-700",
    cancelled: "bg-surface-2 text-muted",
  };
  const label: Record<typeof status, string> = {
    draft: "Draft",
    pending_approval: "Pending Approval",
    changes_requested: "Changes Requested",
    resubmitted: "Resubmitted",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full h-fit ${style[status]}`}>{label[status]}</span>;
}
