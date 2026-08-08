"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, UserPlus, Bell, X, MessageSquare, Check, Lock, Unlock } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withInvitationSent, withInvitationResent, withInvitationRemoved, withParticipantAdmitted, withAdmissionToggled, WorkforceDemoInvitationStatus, NAMED_EMPLOYEE_IDS } from "@/lib/workforceDemoStore";
import { SESSION, findPerson } from "@/lib/workforceDemo";

const FILTERS = ["All", "Invited", "Confirmed", "Declined", "Device Ready", "Waiting", "Admitted", "Needs Support"] as const;

const STATUS_STYLE: Record<WorkforceDemoInvitationStatus, string> = {
  not_invited: "bg-surface-2 text-muted",
  invited: "bg-amber-100 text-amber-700",
  confirmed: "bg-accent-blue/15 text-accent-blue",
  declined: "bg-red-100 text-red-700",
};

// C3: Manager Onboarding and Employee Invitations. Mock-data-driven, fully wired to the shared
// store -- NOT the employee checklist (that's My Session, D1). Every action here (invite, resend,
// remove, admit, toggle admission) is a real store mutation, so the acceptance test holds: "Invite
// Leah Morgan, switch to Employee, confirm the invitation, switch back to Manager, and verify
// Leah's status changed to Confirmed."
export default function WorkforceDemoManagerOnboardingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const joinUrl = `plotabl.workforce/join/${SESSION.id}`;

  const rows = NAMED_EMPLOYEE_IDS.map((id) => ({ id, ...(state.invitations[id] ?? { status: "not_invited" as const, deviceCheck: false, avatarReady: false, admitted: false }) }));
  const filtered = rows.filter((r) => {
    if (filter === "All") return true;
    if (filter === "Invited") return r.status === "invited";
    if (filter === "Confirmed") return r.status === "confirmed";
    if (filter === "Declined") return r.status === "declined";
    if (filter === "Device Ready") return r.deviceCheck;
    if (filter === "Waiting") return r.status === "confirmed" && !r.admitted;
    if (filter === "Admitted") return r.admitted;
    if (filter === "Needs Support") return r.status === "confirmed" && !r.deviceCheck;
    return true;
  });

  const invitedCount = rows.filter((r) => r.status !== "not_invited").length;
  const confirmedCount = rows.filter((r) => r.status === "confirmed").length;

  return (
    <DemoShell pageType="manager-onboarding" searchPlaceholder="Search invitees…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Onboarding & Invitations</h1>
            <p className="text-sm text-muted mt-1">{SESSION.title} · {SESSION.id}</p>
          </div>
          <Link href="/workforce/demo/manager/sessions" className="text-xs font-semibold text-accent-blue hover:underline">← Return to All Sessions</Link>
        </div>

        <div className="qk-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-muted">
            <span><span className="text-foreground font-semibold tabular-nums">{invitedCount + 18}</span> invited</span>
            <span><span className="text-foreground font-semibold tabular-nums">{confirmedCount}</span> confirmed</span>
            <span><span className="text-foreground font-semibold tabular-nums">{rows.filter((r) => r.admitted).length}</span> admitted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-foreground bg-surface-2 rounded-lg px-2.5 py-1.5">{joinUrl}</span>
            <button onClick={() => navigator.clipboard?.writeText(joinUrl)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Copy size={12} /> Copy Invitation Link</button>
            <button
              onClick={() => update(withAdmissionToggled)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${state.admissionOpen ? "bg-accent-blue text-[#16210a]" : "border border-border-subtle text-foreground hover:border-accent-blue"}`}
            >
              {state.admissionOpen ? <Unlock size={12} /> : <Lock size={12} />} {state.admissionOpen ? "Lobby Open" : "Open Lobby"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter === f ? "bg-accent-blue text-[#16210a]" : "bg-surface-2 text-muted hover:text-foreground"}`}>{f}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><UserPlus size={12} /> Invite Employees</button>
          {["Team", "Role", "Department", "Shift"].map((by) => (
            <button key={by} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Invite by {by}</button>
          ))}
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {filtered.map((r) => {
              const p = findPerson(r.id);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-[11px] text-muted">{p.title}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[r.status]}`}>{r.status.replace("_", " ")}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${r.deviceCheck ? "bg-accent-blue/10 text-accent-blue" : "bg-surface-2 text-muted"}`}>{r.deviceCheck ? "Device Ready" : "Device Pending"}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${r.avatarReady ? "bg-accent-blue/10 text-accent-blue" : "bg-surface-2 text-muted"}`}>{r.avatarReady ? "Avatar Ready" : "Avatar Pending"}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${r.admitted ? "bg-green-100 text-green-700" : "bg-surface-2 text-muted"}`}>{r.admitted ? "Admitted" : "Not Admitted"}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {r.status === "not_invited" && (
                      <button onClick={() => update((s) => withInvitationSent(s, r.id))} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Send Invitation</button>
                    )}
                    {r.status === "invited" && (
                      <button onClick={() => update((s) => withInvitationResent(s, r.id))} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Bell size={10} className="inline mr-1" />Resend</button>
                    )}
                    {r.status === "confirmed" && !r.admitted && (
                      <button onClick={() => update((s) => withParticipantAdmitted(s, r.id))} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Check size={10} className="inline mr-1" />Admit</button>
                    )}
                    <button className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><MessageSquare size={10} className="inline mr-1" />Message</button>
                    {r.status !== "not_invited" && (
                      <button onClick={() => update((s) => withInvitationRemoved(s, r.id))} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"><X size={10} className="inline mr-1" />Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-3 text-xs text-muted">+18 additional employees invited via department bulk invite.</div>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
