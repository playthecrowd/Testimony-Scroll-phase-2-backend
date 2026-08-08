"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, ListChecks, UserCheck, Calendar as CalendarIcon, Compass, Users, ClipboardCheck, Coins } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { SELECTED_EXPERIENCE_TITLE, SESSION_PROPOSAL, PEOPLE } from "@/lib/workforceDemo";

// SP-01 (Create/Edit Session Proposal) with SP-03 (Participant Selection) and the Date-Time Picker
// / Funding and Credits overlays folded in as steps within one form, per the spec's own allowance
// ("a page may be implemented as a route, nested route, tabbed page state..."). Submitting routes
// to SP-02 (this checkpoint's proposal, SP-017) since there's no backend to mint a new ID against.
export default function CreateProposalPage() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(SESSION_PROPOSAL.participantIds);
  const [date, setDate] = useState(SESSION_PROPOSAL.proposedDate);
  const [time, setTime] = useState(SESSION_PROPOSAL.proposedTime);
  const eligible = PEOPLE.filter((p) => p.role === "employee");

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function submit() {
    router.push("/workforce/demo/proposals/SP-017");
  }

  return (
    <DemoShell
      pageType="proposal-create"
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
        <Link href="/workforce/demo/decisions/D-2048/departments/dept_advanced_manufacturing" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Department Workspace</Link>
      }
    >
      <div className="max-w-[700px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Session Proposal</h1>
          <p className="text-sm text-muted mt-1">{SELECTED_EXPERIENCE_TITLE}</p>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Date & Time</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="text-muted block mb-1">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm focus-ring" />
            </label>
            <label className="text-xs">
              <span className="text-muted block mb-1">Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm focus-ring" />
            </label>
          </div>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Select Participants</h2>
          <p className="text-xs text-muted mb-3">{selectedIds.length} selected</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto qk-scrollbar pr-1">
            {eligible.map((p) => {
              const checked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${checked ? "bg-accent-blue/10" : "hover:bg-black/[0.03]"}`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-accent-blue border-accent-blue" : "border-border-subtle"}`}>
                    {checked && <span className="w-2 h-2 rounded-sm bg-[#16210a]" />}
                  </span>
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                  <span className="text-xs text-foreground">{p.name}</span>
                  <span className="text-[11px] text-muted ml-auto">{p.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="qk-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Coins size={14} className="text-accent-gold" /> Funding & Credits</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted block mb-0.5">Required</span><span className="text-foreground font-medium">{SESSION_PROPOSAL.creditsRequired} credits</span></div>
            <div><span className="text-muted block mb-0.5">Available</span><span className="text-foreground font-medium">{SESSION_PROPOSAL.creditsAvailable} credits</span></div>
          </div>
          <p className="text-[11px] text-muted mt-3">Host covers admission for all invited participants.</p>
        </div>

        <div className="flex gap-2">
          <Link href="/workforce/demo/decisions/D-2048/departments/dept_advanced_manufacturing" className="text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
            Cancel
          </Link>
          <button onClick={submit} className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
            Submit for Approval
          </button>
        </div>
      </div>
    </DemoShell>
  );
}
