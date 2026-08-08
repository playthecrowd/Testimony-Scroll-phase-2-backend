import Link from "next/link";
import Image from "next/image";
import { Check, Play, Layers, Video, Users, Bookmark, HelpCircle } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { SESSION, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "You're Invited — Plotabl Workforce (Demo)" };

const CHECKED_IN_IDS = ["ava-patel", "leah-morgan", "marcus-allen", "daniel-ruiz", "priya-shah"];

// WF-08: Employee Onboarding and Waiting Room. Mock-data-driven -- see lib/workforceDemo.ts. Shown
// from Ava Patel's identity (an employee/VR participant per the mock roster), not the manager's --
// matches the content guide's correction #3 that employee screens must show an employee identity.
export default function WorkforceDemoOnboardingPage() {
  const host = findPerson(SESSION.hostId);

  return (
    <DemoShell
      pageType="session-onboarding"
      searchPlaceholder="Search sessions, participants, decisions…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="My Session" active icon={Layers} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="3D World" icon={Video} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="Participants & POV" icon={Users} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Leadership Content" icon={Play} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Saved Moments" icon={Bookmark} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Help" icon={HelpCircle} />
        </>
      }
    >
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
          </div>

          <div className="qk-card rounded-2xl p-5">
            <div className="text-xs text-muted mb-1">Your Progress</div>
            <div className="text-sm font-semibold text-foreground mb-4">4 of 5 complete</div>
            <div className="space-y-2.5">
              {[
                { label: "Confirm Invitation", done: true },
                { label: "Create Your Avatar", done: true },
                { label: "Check Your Device", done: true },
                { label: "Confirm Admission", done: true },
                { label: "Ready to Join", done: false },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-accent-blue text-[#16210a]" : "border border-border-subtle"}`}>
                    {step.done && <Check size={12} />}
                  </span>
                  <span className={step.done ? "text-foreground" : "text-muted"}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">While You Wait</h2>
            <div className="grid grid-cols-2 gap-3">
              <ClipCard title="Why the Future Factory Workflow Matters" by={host.name} />
              <ClipCard title="How We'll Work — Together" by={findPerson("leah-morgan").name} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <div className="text-xs text-muted mb-1">Session opens in</div>
            <div className="text-4xl font-bold text-foreground tabular-nums">08:42</div>
            <p className="text-[11px] text-muted mt-1">We&apos;ll notify you when the session opens.</p>
          </div>
          <Link
            href="/workforce/demo/sessions/FF-042/participants"
            className="block text-center text-sm font-semibold px-4 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
          >
            Join 3D World
          </Link>
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

function ClipCard({ title, by }: { title: string; by: string }) {
  return (
    <div className="qk-card rounded-xl overflow-hidden">
      <div className="relative w-full aspect-video bg-surface-2 flex items-center justify-center">
        <Play size={22} className="text-accent-blue" />
      </div>
      <div className="p-2.5">
        <div className="text-xs font-medium text-foreground leading-snug">{title}</div>
        <div className="text-[10px] text-muted mt-0.5">{by}</div>
      </div>
    </div>
  );
}
