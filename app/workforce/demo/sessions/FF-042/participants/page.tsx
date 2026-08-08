import Link from "next/link";
import { Layers, Video, Users, Play, Bookmark, HelpCircle } from "lucide-react";
import { DemoShell, DemoNavItem } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { LIVE_PARTICIPANTS, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Participants & Live POV — Plotabl Workforce (Demo)" };

// WF-09: Employee Participants and POV Directory. Mock-data-driven -- see lib/workforceDemo.ts.
// "Watch POV" for a VR-live participant links into the WF-10-equivalent detail page; other states
// have no destination in this checkpoint (consistent with the content guide -- only VR-live cards
// expose Watch POV).
export default function WorkforceDemoParticipantsPage() {
  return (
    <DemoShell
      pageType="session-participants"
      searchPlaceholder="Search participants, content, notes, or recordings…"
      nav={
        <>
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="My Session" icon={Layers} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="3D World" icon={Video} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/participants" label="Participants & POV" active icon={Users} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Leadership Content" icon={Play} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Saved Moments" icon={Bookmark} />
          <DemoNavItem href="/workforce/demo/sessions/FF-042/onboarding" label="Help" icon={HelpCircle} />
        </>
      }
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Participants & Live POV</h1>
            <p className="text-sm text-muted mt-1">See who is active, follow collaborators, and open available live viewpoints.</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue h-fit">● Live · 00:23:18</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {["All", "In 3D World", "VR Live", "Available", "Waiting", "Hosts"].map((f, i) => (
            <button key={f} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${i === 0 ? "bg-accent-blue text-[#16210a]" : "bg-surface-2 text-muted hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LIVE_PARTICIPANTS.map((lp) => {
            const p = findPerson(lp.personId);
            const card = (
              <div key={lp.personId} className={`qk-card rounded-xl p-3.5 ${lp.platform === "vr" ? "ring-2 ring-accent-blue" : ""}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="sm" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{p.name}</div>
                      <div className="text-[10px] text-muted">{lp.state === "host" ? "Host" : p.title.split(",")[0]}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">{lp.state.toUpperCase()}</span>
                </div>
                <div className="text-[11px] text-muted mb-3">{lp.location}</div>
                {lp.platform === "vr" ? (
                  <Link href={`/workforce/demo/sessions/FF-042/pov/${lp.personId}`} className="block text-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
                    Watch POV
                  </Link>
                ) : (
                  <button className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                    View Profile
                  </button>
                )}
              </div>
            );
            return card;
          })}
        </div>

        <Link href="/workforce/demo/sessions/FF-042/onboarding" className="inline-block text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
          Return to 3D World
        </Link>
      </div>
    </DemoShell>
  );
}
