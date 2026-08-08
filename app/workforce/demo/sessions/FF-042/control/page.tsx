import Link from "next/link";
import Image from "next/image";
import {
  Play, Square, Users, Radio, ListChecks, ClipboardCheck, Video, MessageSquare, Archive, Layers,
  PlayCircle, PauseCircle, MonitorPlay, Radio as BroadcastIcon, Coins, Lock, ShieldCheck,
  Cloud, UserPlus, Bell,
} from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DECISION, SESSION, LIVE_PARTICIPANTS, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Session Control — Plotabl Workforce (Demo)" };

const RUN_OF_SHOW = [
  { step: "Welcome & leadership clip", duration: "5 min", status: "Pre-Session" },
  { step: "Mobile factory orientation", duration: "10 min", status: "Upcoming" },
  { step: "Inspection assessment", duration: "15 min", status: "Upcoming" },
  { step: "VR collaborative breakout", duration: "20 min", status: "Upcoming" },
  { step: "Review & feedback", duration: "10 min", status: "Upcoming" },
];

const CONTROLS = [
  { label: "Start All Experiences", icon: PlayCircle },
  { label: "Open POV Breakout", icon: Video },
  { label: "Pause Experience", icon: PauseCircle },
  { label: "Play Leadership Clip", icon: MonitorPlay },
  { label: "Broadcast Message", icon: BroadcastIcon },
  { label: "Allocate Credits", icon: Coins },
  { label: "Launch Assessment", icon: ClipboardCheck },
  { label: "Lock New Entries", icon: Lock },
];

// WF-05: Manager Session Control. Mock-data-driven -- see lib/workforceDemo.ts. Deliberately built
// out as the largest, most detailed page in the demo per explicit feedback ("the big page is the
// control panel for the manager to start and stop the experience -- that's going to be big for
// us... we need to really break out what that looks like"). "Start Session" links to the
// Participants view (the closest built next step) rather than being a dead button -- there's no
// live/WebRTC layer in this checkpoint.
export default function WorkforceDemoSessionControlPage() {
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell
      pageType="session-control"
      searchPlaceholder="Search sessions, people, decisions…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo/sessions/FF-042/control" label="Session Overview" active icon={Layers} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Onboarding" icon={Users} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/control" label="Live Control" icon={Radio} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="Participants" icon={ListChecks} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="Assessments" icon={ClipboardCheck} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="POV Breakouts" icon={Video} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/control" label="Leadership Content" icon={MessageSquare} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/analytics" label="Session Analytics" icon={ClipboardCheck} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/archive" label="Recordings & Archive" icon={Archive} />
        </>
      }
      navFooter={
        <Link href="/workforce/demo/decisions/D-2048/workspace" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Track</Link>
      }
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Sessions / {SESSION.id}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{SESSION.title}</h1>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue">Ready to Start</span>
            <div className="flex items-center gap-3 text-xs text-muted mt-2">
              <span>{DECISION.title} · {DECISION.id}</span>
              <span>{SESSION.id} · Sep 18 · 2:00 PM</span>
              <span>Manager: {host.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/workforce/demo/sessions/FF-042/participants"
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
            >
              <Play size={14} /> Start Session
            </Link>
            <button disabled className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-muted opacity-50 cursor-not-allowed">
              <Square size={14} /> End Session
            </button>
          </div>
        </div>

        {/* Live preview with the overlay detail the reference shows: inspection/workflow pins, an
            inset leadership-briefing panel, and a bottom assessment-question card. */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
          <Image src={DECISION.heroImageUrl} alt="Session preview" fill className="object-cover" priority />
          <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">Live Preview</span>
          <span className="absolute bottom-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">Mobile Avatar World</span>

          <div className="absolute top-1/3 left-[20%] flex flex-col items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-blue ring-4 ring-accent-blue/30" />
            <span className="mt-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-black/70 text-white">Inspection Point A</span>
          </div>
          <div className="absolute top-1/2 left-1/2 flex flex-col items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-blue ring-4 ring-accent-blue/30" />
            <span className="mt-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-black/70 text-white">Workflow Station 3</span>
          </div>

          <div className="hidden sm:block absolute top-3 right-3 w-40 rounded-lg overflow-hidden border-2 border-white/80 shadow-lg">
            <div className="relative w-full aspect-video">
              <Image src="/workforce/demo/decisions/d-2041-thumbnail.webp" alt="" fill className="object-cover" />
            </div>
            <div className="bg-black/70 text-white text-[9px] font-medium px-2 py-1">Department Leadership Briefing</div>
          </div>

          <div className="hidden sm:block absolute bottom-3 right-3 w-64 rounded-lg bg-black/75 text-white p-2.5">
            <div className="text-[9px] font-semibold text-accent-blue-light mb-1">Inspection Check 2 of 6</div>
            <div className="text-[11px] font-medium mb-1.5">Which workflow requirement is not yet satisfied?</div>
            <div className="space-y-1 text-[10px]">
              <div className="px-1.5 py-1 rounded bg-white/10">A · Proper tooling verification</div>
              <div className="px-1.5 py-1 rounded bg-white/10">B · Documentation sign-off</div>
              <div className="px-1.5 py-1 rounded bg-white/10">C · Safety lockout confirmation</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="qk-card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Session Controls</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {CONTROLS.map((c) => (
                <button key={c.label} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors text-left">
                  <c.icon size={14} className="text-accent-gold shrink-0" /> {c.label}
                </button>
              ))}
            </div>
          </div>
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Employee Onboarding</h3>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <path className="text-surface-2" stroke="currentColor" strokeWidth="3" fill="none" d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 1 1 0-31" />
                  <path
                    className="text-accent-blue"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${(SESSION.avatarsReady / SESSION.invited) * 100}, 100`}
                    d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 1 1 0-31"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{SESSION.avatarsReady}</span>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between gap-3"><span className="text-muted">Invited</span><span className="text-foreground font-medium">{SESSION.invited}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Checked in</span><span className="text-foreground font-medium">{SESSION.checkedIn}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">Avatars ready</span><span className="text-foreground font-medium">{SESSION.avatarsReady}</span></div>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <button className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
                <UserPlus size={12} /> Invite Employees
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                <Bell size={12} /> Send Reminder
              </button>
            </div>
            <Link href="/workforce/demo/sessions/FF-042/onboarding" className="block text-center text-xs font-semibold px-3 py-2 rounded-lg border border-accent-blue text-accent-blue hover:bg-accent-blue/10 transition-colors">
              View Waiting Room
            </Link>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Experience Channels</h3>
            <div className="space-y-2.5 text-xs">
              {[
                { label: "Mobile Avatar World", status: "16 ready", ready: true },
                { label: "VR Breakout", status: "4 ready · 2 queued", ready: true },
                { label: "Leadership Stream", status: "Loaded", ready: true },
                { label: "Assessment", status: "6 questions ready", ready: true },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between">
                  <span className="text-foreground">{c.label}</span>
                  <span className="text-[10px] font-medium text-accent-blue">{c.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Live POV Collaborators</h3>
            <div className="grid grid-cols-2 gap-2">
              {LIVE_PARTICIPANTS.filter((p) => p.state !== "host").map((lp) => {
                const p = findPerson(lp.personId);
                return (
                  <div key={lp.personId} className="relative rounded-lg overflow-hidden aspect-video bg-surface-2">
                    <Image src={DECISION.thumbnailUrl} alt="" fill className="object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center gap-1">
                      <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                      <span className="text-[10px] text-white font-medium truncate">{p.name}</span>
                    </div>
                    <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${lp.platform === "vr" ? "bg-accent-blue text-[#16210a]" : "bg-black/60 text-white"}`}>
                      {lp.state.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Session Run of Show</h3>
          <div className="space-y-2">
            {RUN_OF_SHOW.map((r, i) => (
              <div key={r.step} className="flex items-center gap-3 text-xs py-1.5 border-b border-border-subtle last:border-0">
                <span className="w-5 h-5 rounded-full bg-surface-2 text-muted flex items-center justify-center text-[10px] font-semibold shrink-0">{i + 1}</span>
                <span className="text-foreground flex-1">{r.step}</span>
                <span className="text-muted">{r.duration}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-surface-2 text-muted"}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
