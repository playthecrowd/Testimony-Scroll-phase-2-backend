"use client";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Play, Square, ClipboardCheck, Video, MessageSquare, Archive, Coins, ShieldCheck, Cloud, Copy, Radio,
} from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { useWorkforcePreviewRole } from "@/components/workforce/demo/RoleContext";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withSessionStarted, withSessionEnded } from "@/lib/workforceDemoStore";
import { DECISION, SESSION, findPerson } from "@/lib/workforceDemo";

const RUN_OF_SHOW = [
  { step: "Welcome & leadership clip", duration: "5 min" },
  { step: "Mobile factory orientation", duration: "10 min" },
  { step: "Inspection assessment", duration: "15 min" },
  { step: "VR collaborative breakout", duration: "20 min" },
  { step: "Review & feedback", duration: "10 min" },
];

// C2: Manager Session Overview. Mock-data-driven; the Manager's central control page for one
// session (session-scoped route, migrated from the old fixed /sessions/FF-042/control). Reads
// sessionStatus from the shared store so Start/End Session persists across navigation and role
// switches. Leadership roles reach this same page (per resolveRoleDestination's read-only
// mapping) but `canControl` gates every interactive control off -- they see everything, control
// nothing, matching the acceptance test: "Switch from Manager to Department Leader on FF-042 and
// verify the same session opens read-only."
export default function WorkforceDemoManagerSessionOverviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { role } = useWorkforcePreviewRole();
  const { state, update } = useWorkforceDemoStore();
  const host = findPerson(SESSION.hostId);
  const canControl = role === "manager";
  const joinUrl = `plotabl.workforce/join/${SESSION.id}`;

  return (
    <DemoShell pageType="manager-session-overview" searchPlaceholder="Search sessions, people, decisions…">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Sessions / {SESSION.id}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{SESSION.title}</h1>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue capitalize">{state.sessionStatus.replace("_", " ")}</span>
            <div className="flex items-center gap-3 text-xs text-muted mt-2">
              <span>{DECISION.title} · {DECISION.id}</span>
              <span>{SESSION.id} · Sep 18 · 2:00 PM</span>
              <span>Manager: {host.name}</span>
            </div>
            {!canControl && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2 inline-block">You&apos;re previewing this session read-only. Only the Manager can start, end, or admit participants.</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canControl ? (
              state.sessionStatus !== "live" ? (
                <button onClick={() => update(withSessionStarted)} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
                  <Play size={14} /> Start Session
                </button>
              ) : (
                <button onClick={() => update(withSessionEnded)} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                  <Square size={14} /> End Session
                </button>
              )
            ) : (
              <button disabled className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-muted opacity-50 cursor-not-allowed">
                <Play size={14} /> Start Session
              </button>
            )}
            <button onClick={() => navigator.clipboard?.writeText(joinUrl)} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
              <Copy size={14} /> Copy Join Link
            </button>
          </div>
        </div>

        <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
          <Image src={DECISION.heroImageUrl} alt="Session preview" fill className="object-cover" priority />
          <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">{state.sessionStatus === "live" ? "Live" : "Preview"}</span>
          <span className="absolute bottom-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">Mobile Avatar World</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Link href="/workforce/demo/manager/sessions/FF-042/onboarding" className="qk-card rounded-2xl p-4 hover:border-accent-blue/50 transition-colors">
            <h3 className="text-sm font-semibold text-foreground mb-2">Open Onboarding</h3>
            <p className="text-xs text-muted">Invite employees, review admission, and manage the waiting room.</p>
          </Link>
          <Link href="/workforce/demo/manager/sessions/FF-042/participants" className="qk-card rounded-2xl p-4 hover:border-accent-blue/50 transition-colors">
            <h3 className="text-sm font-semibold text-foreground mb-2">Open Participants</h3>
            <p className="text-xs text-muted">Administer the live roster, assign POVs, and monitor progress.</p>
          </Link>
          <Link href="/workforce/demo/manager/sessions/FF-042/leadership-content" className="qk-card rounded-2xl p-4 hover:border-accent-blue/50 transition-colors">
            <h3 className="text-sm font-semibold text-foreground mb-2">Preview Leadership Content</h3>
            <p className="text-xs text-muted">Release or withdraw briefings shown to participants.</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="qk-card rounded-2xl p-4 flex flex-col">
            <h2 className="text-sm font-semibold text-foreground mb-3">Recording & Archive</h2>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-red-600">REC</span>
            </div>
            <div className="space-y-2 text-xs flex-1">
              {Object.entries(SESSION.recording).map(([key, on]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${on ? "bg-accent-blue/15 text-accent-blue" : "bg-surface-2 text-muted"}`}>{on ? "ON" : "OFF"}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
              <ShieldCheck size={16} className="text-accent-gold shrink-0" />
              <Cloud size={16} className="text-accent-gold shrink-0" />
              <p className="text-[10px] text-muted">All authorized streams archive to this decision.</p>
            </div>
            <Link href="/workforce/demo/manager/sessions/FF-042/archive" className="mt-3 text-xs font-semibold text-accent-blue hover:underline flex items-center gap-1"><Archive size={12} /> Open Archive</Link>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Credit & Funding Summary</h3>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted flex items-center gap-1"><Coins size={12} /> Required</span>
              <span className="text-foreground font-medium">{SESSION.creditPool} credits</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Funding Source</span>
              <span className="text-foreground font-medium">Host covers admission</span>
            </div>
            <div className="flex gap-2 mt-3">
              <Link href="/workforce/demo/manager/sessions/FF-042/analytics" className="flex-1 text-center text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors flex items-center justify-center gap-1"><ClipboardCheck size={12} /> Analytics</Link>
              <Link href="/workforce/demo/manager/sessions/FF-042/pov-breakouts" className="flex-1 text-center text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors flex items-center justify-center gap-1"><Video size={12} /> POV Breakouts</Link>
            </div>
          </div>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Radio size={14} className="text-accent-gold" /> Session Run of Show</h3>
          <div className="space-y-2">
            {RUN_OF_SHOW.map((r, i) => (
              <div key={r.step} className="flex items-center gap-3 text-xs py-1.5 border-b border-border-subtle last:border-0">
                <span className="w-5 h-5 rounded-full bg-surface-2 text-muted flex items-center justify-center text-[10px] font-semibold shrink-0">{i + 1}</span>
                <span className="text-foreground flex-1">{r.step}</span>
                <span className="text-muted">{r.duration}</span>
              </div>
            ))}
          </div>
          <Link href="/workforce/demo/manager/sessions/FF-042/leadership-content" className="mt-3 text-xs font-semibold text-accent-blue hover:underline flex items-center gap-1"><MessageSquare size={12} /> Manage Leadership Content</Link>
        </div>
      </div>
    </DemoShell>
  );
}
