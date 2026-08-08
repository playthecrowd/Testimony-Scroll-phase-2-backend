import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Info, AlertTriangle, HelpCircle as HelpCircleIcon, Layers, Video, Users, Play, Bookmark, HelpCircle } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DECISION, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Live Collaborative POV — Plotabl Workforce (Demo)" };

const NOTES = [
  { icon: Check, body: "Gathering visual confirmation on fan case inspection.", time: "10:15:22" },
  { icon: Info, body: "Inspection step confirmed. No issues observed.", time: "10:16:08" },
  { icon: AlertTriangle, body: "Tool access could be improved on lower bracket.", time: "10:16:45" },
  { icon: HelpCircleIcon, body: "Is safety lockout required before seal check?", time: "10:17:12" },
];

// WF-10: Employee Live Collaborator POV. Mock-data-driven -- see lib/workforceDemo.ts. Only
// "ava-patel" resolves in this checkpoint (the sole VR-live participant in the mock roster) --
// other ids correctly 404 rather than fabricating a POV feed for someone who isn't VR-live.
export default async function WorkforceDemoPovDetailPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  if (participantId !== "ava-patel") notFound();
  const p = findPerson("ava-patel");

  return (
    <DemoShell
      pageType="session-pov"
      searchPlaceholder="Search sessions, participants, decisions…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo/sessions/FF-042/control" label="Session Overview" icon={Layers} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="Participants" active icon={Video} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="POV Breakouts" icon={Users} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Leadership Content" icon={Play} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Saved Moments" icon={Bookmark} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Help" icon={HelpCircle} />
        </>
      }
      navFooter={
        <Link href="/workforce/demo/sessions/FF-042/control" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Track</Link>
      }
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted">
                <Link href="/workforce/demo/sessions/FF-042/participants" className="hover:text-accent-blue">Participants & POV</Link> / {p.name}
              </div>
              <h1 className="text-xl font-bold text-foreground">{p.name} — Live Collaborative POV</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">VR LIVE</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted">EMPLOYEE</span>
                <span className="text-xs text-muted">{p.title}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/workforce/demo/sessions/FF-042/participants" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Return to Participants</Link>
              <Link href="/workforce/demo/sessions/FF-042/onboarding" className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Re-enter 3D World</Link>
            </div>
          </div>

          <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
            <Image src={DECISION.thumbnailUrl} alt="Live POV" fill className="object-cover" />
            <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">Live POV</span>
          </div>

          <div className="qk-card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Live Notes & Findings</h2>
            <div className="space-y-2.5">
              {NOTES.map((n, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <n.icon size={13} className="text-accent-blue mt-0.5 shrink-0" />
                  <span className="text-muted shrink-0">{n.time}</span>
                  <span className="text-foreground">{n.body}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Add Shared Note</button>
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Save Moment</button>
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Ask Participant</button>
              <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Request Manager Support</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="qk-card rounded-2xl p-4 text-center">
            <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="lg" className="mx-auto mb-2" />
            <div className="text-sm font-semibold text-foreground">{p.name}</div>
            <div className="text-xs text-muted">{p.title}</div>
            <div className="text-[11px] text-muted mt-3">Current Objective</div>
            <div className="text-xs text-foreground">Verify workflow sequence and identify readiness gaps.</div>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Checkpoint Progress</h3>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-1">
              <div className="h-full bg-accent-blue rounded-full" style={{ width: "66%" }} />
            </div>
            <div className="text-[11px] text-muted">4 of 6 checkpoints</div>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Related Decision Details</h3>
            <div className="text-[11px] text-muted mb-1">Executive Intent</div>
            <p className="text-xs text-foreground mb-2">{DECISION.executiveIntent}</p>
            <Link href="/workforce/demo/decisions/D-2048" className="text-xs text-accent-blue hover:underline">View Full Decision Context</Link>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
