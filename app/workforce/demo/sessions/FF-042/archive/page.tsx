import Link from "next/link";
import { Play, Download, ClipboardCheck, Layers, Users, ClipboardList, Archive, Bookmark } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { SESSION, SESSION_RECORDINGS, SAVED_MOMENTS, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Recordings & Archive — Plotabl Workforce (Demo)" };

const CHANNEL_LABEL: Record<string, string> = {
  master: "Master Stream",
  mobileWorld: "Mobile Avatar World",
  vrPov: "VR POV",
  leadershipStream: "Leadership Stream",
};

// WF-06: Recordings & Archive. Mock-data-driven -- see lib/workforceDemo.ts. Reached from Session
// Control's and Session Analytics' "Recordings & Archive" nav item, which previously pointed back
// at themselves (no dedicated page existed). "Add to Decision Evidence" per recording writes
// nothing (no backend) but routes to the real Evidence & Outcomes page, closing the same loop
// Analytics' equivalent action closes.
export default function WorkforceDemoArchivePage() {
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell
      pageType="session-archive"
      searchPlaceholder="Search recordings, moments, or transcripts…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo/sessions/FF-042/control" label="Session Overview" icon={Layers} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="Participants" icon={Users} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/analytics" label="Session Analytics" icon={ClipboardCheck} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/archive" label="Recordings & Archive" active icon={Archive} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/control" label="Feedback" icon={ClipboardList} />
        </>
      }
      navFooter={
        <Link href="/workforce/demo/decisions/D-2048/workspace" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Track</Link>
      }
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/sessions/FF-042/control" className="hover:text-accent-blue">{SESSION.title}</Link> / Recordings & Archive
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
                <span className="w-9 h-9 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
                  <Play size={14} className="text-accent-blue" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{rec.label}</div>
                  <div className="text-[11px] text-muted">{CHANNEL_LABEL[rec.channel]} · {rec.durationMinutes} min · {rec.sizeLabel}</div>
                </div>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                  Play
                </button>
                <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                  <Download size={12} /> Download
                </button>
                <Link
                  href="/workforce/demo/decisions/D-2048/evidence"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
                >
                  <ClipboardCheck size={12} /> Add to Decision Evidence
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Bookmark size={14} className="text-accent-gold" />
            <h2 className="text-sm font-semibold text-foreground">Saved Moments</h2>
          </div>
          <div className="space-y-3">
            {SAVED_MOMENTS.map((m) => {
              const p = findPerson(m.personId);
              return (
                <div key={m.id} className="flex items-start gap-2.5 text-sm">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground">{m.note}</div>
                    <div className="text-[11px] text-muted mt-0.5">{p.name} · {m.timestamp}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-muted">All authorized streams and saved moments archive to this decision and remain available to Department Leadership and Enterprise Owners.</p>
      </div>
    </DemoShell>
  );
}
