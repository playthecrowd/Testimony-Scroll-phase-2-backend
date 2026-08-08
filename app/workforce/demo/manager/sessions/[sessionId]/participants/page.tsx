"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageSquare, RotateCcw, Radio } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withParticipantAdmitted, withInvitationRemoved, NAMED_EMPLOYEE_IDS } from "@/lib/workforceDemoStore";
import { SESSION, LIVE_PARTICIPANTS, findPerson } from "@/lib/workforceDemo";

// C4: Manager Participants. Mock-data-driven, distinct from Employee Participants & POV -- this
// is the administration surface (Admit/Remove/Reinvite are real store mutations), the employee
// page is view-only. Admitting here is what makes "Join Session" available on the employee side
// (D1's acceptance test).
export default function WorkforceDemoManagerParticipantsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();

  return (
    <DemoShell pageType="manager-participants" searchPlaceholder="Search participants…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Participants</h1>
            <p className="text-sm text-muted mt-1">Administer the live roster for {SESSION.title}.</p>
          </div>
          <Link href="/workforce/demo/manager/sessions/FF-042/pov-breakouts" className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors flex items-center gap-1.5"><Radio size={13} /> Manage POV Breakouts</Link>
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {NAMED_EMPLOYEE_IDS.map((id) => {
              const p = findPerson(id);
              const inv = state.invitations[id] ?? { status: "not_invited" as const, deviceCheck: false, avatarReady: false, admitted: false };
              const live = LIVE_PARTICIPANTS.find((lp) => lp.personId === id);
              return (
                <div key={id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-[11px] text-muted">{p.title} · {live?.location ?? "Not yet in session"}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${inv.admitted ? "bg-green-100 text-green-700" : inv.status === "confirmed" ? "bg-amber-100 text-amber-700" : "bg-surface-2 text-muted"}`}>
                    {inv.admitted ? "Admitted" : inv.status === "confirmed" ? "Waiting" : inv.status === "declined" ? "Declined" : "Not Checked In"}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${inv.deviceCheck ? "bg-accent-blue/10 text-accent-blue" : "bg-surface-2 text-muted"}`}>{inv.deviceCheck ? "Device Ready" : "Device Pending"}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {inv.status === "confirmed" && !inv.admitted && (
                      <button onClick={() => update((s) => withParticipantAdmitted(s, id))} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Check size={10} className="inline mr-1" />Admit</button>
                    )}
                    <button className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><MessageSquare size={10} className="inline mr-1" />Message</button>
                    {inv.status === "declined" && (
                      <button onClick={() => update((s) => withInvitationRemoved(s, id))} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><RotateCcw size={10} className="inline mr-1" />Reinvite</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
