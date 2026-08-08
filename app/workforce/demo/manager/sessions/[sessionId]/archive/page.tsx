"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Play, Download, ClipboardCheck, Share2, Bookmark } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withMomentShared } from "@/lib/workforceDemoStore";
import { SESSION, SESSION_RECORDINGS, findPerson } from "@/lib/workforceDemo";

const CHANNEL_LABEL: Record<string, string> = {
  master: "Master Stream",
  mobileWorld: "Mobile Avatar World",
  vrPov: "VR POV",
  leadershipStream: "Leadership Stream",
};

// C9: Manager Recordings & Archive. Mock-data-driven, session-scoped (migrated from the fixed
// /sessions/FF-042/archive). Shows every saved moment (shared or not) since this is the Manager's
// own admin view; "Share with Leadership" flips a moment's `shared` flag in the store, which is
// exactly what makes it appear on the org-wide Evidence & Outcomes hub -- closing the loop the
// acceptance test describes: "Save a moment as Employee, end the session as Manager, verify the
// evidence becomes visible to Department Leader and Approver."
export default function WorkforceDemoManagerArchivePage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell pageType="manager-archive" searchPlaceholder="Search recordings, moments, or transcripts…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/manager/sessions/FF-042" className="hover:text-accent-blue">{SESSION.title}</Link> / Recordings & Archive
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recordings & Archive</h1>
          <p className="text-sm text-muted mt-1">{SESSION.id} · Sep 18 · 2:00 PM · Manager: {host.name}</p>
        </div>

        <div className="qk-card rounded-2xl overflow-hidden">
          <h2 className="text-sm font-semibold text-foreground p-4 pb-3">Recorded Streams</h2>
          <div className="divide-y divide-border-subtle">
            {SESSION_RECORDINGS.map((rec) => (
              <div key={rec.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-9 h-9 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0"><Play size={14} className="text-accent-blue" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{rec.label}</div>
                  <div className="text-[11px] text-muted">{CHANNEL_LABEL[rec.channel]} · {rec.durationMinutes} min · {rec.sizeLabel}</div>
                </div>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Play</button>
                <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Download size={12} /> Download</button>
                <Link href="/workforce/demo/evidence" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><ClipboardCheck size={12} /> Add to Decision Evidence</Link>
              </div>
            ))}
          </div>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3"><Bookmark size={14} className="text-accent-gold" /><h2 className="text-sm font-semibold text-foreground">Saved Moments</h2></div>
          <div className="space-y-3">
            {state.savedMoments.length === 0 ? (
              <p className="text-xs text-muted">No saved moments yet.</p>
            ) : (
              state.savedMoments.map((m) => {
                const p = findPerson(m.personId);
                return (
                  <div key={m.id} className="flex items-start gap-2.5 text-sm">
                    <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground">{m.note}</div>
                      <div className="text-[11px] text-muted mt-0.5">{p.name} · {m.timestamp}</div>
                    </div>
                    {m.shared ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue shrink-0">Shared</span>
                    ) : (
                      <button onClick={() => update((s) => withMomentShared(s, m.id))} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors shrink-0">
                        <Share2 size={10} /> Share with Leadership
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted">Shared streams and moments archive to this decision and remain available to Department Leadership and Enterprise Owners.</p>
      </div>
    </DemoShell>
  );
}
