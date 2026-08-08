"use client";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Play, Calendar, MessageSquare } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withInvitationConfirmed, withInvitationDeclined } from "@/lib/workforceDemoStore";
import { SESSION, LEADERSHIP_CONTENT_ITEMS, CHECKED_IN_IDS, findPerson } from "@/lib/workforceDemo";

const EMPLOYEE_ID = "ava-patel";

// D1: Employee My Session. Mock-data-driven; the employee's invitation/onboarding/lobby/status
// home (migrated from the old fixed /sessions/FF-042/onboarding). The checklist reads live from
// the shared store's invitation record for the previewed employee -- "Join Session" only enables
// once the Manager has admitted them (C4's acceptance test), and "Confirm/Decline Invitation" are
// real store mutations the Manager Onboarding page (C3) sees immediately.
export default function WorkforceDemoMySessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();
  const host = findPerson(SESSION.hostId);
  const inv = state.invitations[EMPLOYEE_ID] ?? { status: "not_invited" as const, deviceCheck: false, avatarReady: false, admitted: false };
  const released = LEADERSHIP_CONTENT_ITEMS.filter((c) => state.leadershipContentStatus[c.id] === "released");

  const steps = [
    { label: "Confirm Invitation", done: inv.status === "confirmed" || inv.status === "declined" },
    { label: "Create Your Avatar", done: inv.avatarReady },
    { label: "Check Your Device", done: inv.deviceCheck },
    { label: "Confirm Admission", done: inv.admitted },
    { label: "Ready to Join", done: inv.admitted },
  ];

  return (
    <DemoShell pageType="my-session" searchPlaceholder="Search sessions, participants, decisions…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide font-semibold mb-1">You&apos;re Invited</div>
            <h1 className="text-2xl font-bold text-foreground">{SESSION.title}</h1>
            <p className="text-sm text-muted mt-1">Learn, practice, and help validate the new Future Factory workflow.</p>
            <div className="text-xs text-muted mt-2">{SESSION.id} · Sep 18 · 2:00 PM · {SESSION.durationMinutes} min</div>
          </div>

          <div className="qk-card rounded-2xl p-4 flex items-center gap-3">
            <WorkforceAvatar name={host.name} imageUrl={host.portraitUrl} size="md" />
            <div>
              <div className="text-xs text-muted">Hosted by</div>
              <div className="text-sm font-semibold text-foreground">{host.name}</div>
            </div>
            <button className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><MessageSquare size={12} /> Contact Manager</button>
          </div>

          {inv.status === "invited" && (
            <div className="qk-card rounded-2xl p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">You&apos;re invited to this session. Confirm to continue onboarding.</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => update((s) => withInvitationConfirmed(s, EMPLOYEE_ID))} className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Confirm</button>
                <button onClick={() => update((s) => withInvitationDeclined(s, EMPLOYEE_ID))} className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Decline</button>
              </div>
            </div>
          )}

          <div className="qk-card rounded-2xl p-5">
            <div className="text-xs text-muted mb-1">Your Progress</div>
            <div className="text-sm font-semibold text-foreground mb-4">{steps.filter((s) => s.done).length} of {steps.length} complete</div>
            <div className="space-y-2.5">
              {steps.map((step) => (
                <div key={step.label} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-accent-blue text-[#16210a]" : "border border-border-subtle"}`}>
                    {step.done && <Check size={12} />}
                  </span>
                  <span className={step.done ? "text-foreground" : "text-muted"}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {released.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">While You Wait</h2>
              <div className="grid grid-cols-2 gap-3">
                {released.map((c) => (
                  <div key={c.id} className="qk-card rounded-xl overflow-hidden">
                    <div className="relative w-full aspect-video bg-surface-2 flex items-center justify-center"><Play size={22} className="text-accent-blue" /></div>
                    <div className="p-2.5">
                      <div className="text-xs font-medium text-foreground leading-snug">{c.title}</div>
                      <div className="text-[10px] text-muted mt-0.5">{findPerson(c.ownerId).name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {inv.admitted ? (
            <Link href="/workforce/demo/my-session/FF-042/world" className="block text-center text-sm font-semibold px-4 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Join Session</Link>
          ) : (
            <button disabled className="w-full text-center text-sm font-medium px-4 py-3 rounded-lg border border-border-subtle text-muted opacity-50 cursor-not-allowed">Join Session (waiting for admission)</button>
          )}
          <button className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Calendar size={12} /> Add to Calendar</button>
          <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden">
            <Image src="/workforce/demo/decisions/d-2048-thumbnail.webp" alt="Your avatar" fill className="object-cover" />
          </div>
          <div>
            <div className="text-xs text-muted mb-2">{CHECKED_IN_IDS.length} of {SESSION.checkedIn} checked in</div>
            <div className="flex -space-x-1.5">
              {CHECKED_IN_IDS.map((id) => {
                const p = findPerson(id);
                return <WorkforceAvatar key={id} name={p.name} imageUrl={p.portraitUrl} size="sm" className="ring-2 ring-surface" />;
              })}
              <span className="w-8 h-8 rounded-full bg-surface-2 text-[10px] text-muted flex items-center justify-center ring-2 ring-surface">+{SESSION.checkedIn - CHECKED_IN_IDS.length}</span>
            </div>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
