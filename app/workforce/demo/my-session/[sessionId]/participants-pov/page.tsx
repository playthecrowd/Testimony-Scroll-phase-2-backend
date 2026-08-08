import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { SESSION, LIVE_PARTICIPANTS, POV_BREAKOUT_GROUPS, findPerson } from "@/lib/workforceDemo";

export const metadata = { title: "Participants & Live POV — Plotabl Workforce (Demo)" };

const EMPLOYEE_ID = "ava-patel";

// D3: Employee Participants & POV. Mock-data-driven, view-only -- migrated from the old fixed
// /sessions/FF-042/participants, distinct from Manager Participants (no Admit/Remove/Reassign
// controls exist on this page at all, satisfying the acceptance test that employees can see but
// not change their assigned POV).
export default function WorkforceDemoParticipantsPovPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const myGroup = POV_BREAKOUT_GROUPS.find((g) => g.memberIds.includes(EMPLOYEE_ID));

  return (
    <DemoShell pageType="my-session-participants-pov" searchPlaceholder="Search participants, content, notes, or recordings…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Participants & Live POV</h1>
            <p className="text-sm text-muted mt-1">See who is active, follow collaborators, and open available live viewpoints.</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue h-fit">● Live · 00:23:18</span>
        </div>

        {myGroup && (
          <div className="qk-card rounded-xl p-4">
            <div className="text-xs text-muted mb-1">Your POV Group</div>
            <div className="text-sm font-semibold text-foreground">{myGroup.name}</div>
            <p className="text-xs text-muted mt-1">{myGroup.objective}</p>
          </div>
        )}

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
                  <Link href={`/workforce/demo/my-session/FF-042/pov/${lp.personId}`} className="block text-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
                    {lp.personId === EMPLOYEE_ID ? "View My POV" : "View Collaborator"}
                  </Link>
                ) : (
                  <button className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">View Profile</button>
                )}
              </div>
            );
            return card;
          })}
        </div>

        <Link href="/workforce/demo/my-session/FF-042/world" className="inline-block text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">
          Return to 3D World
        </Link>
      </div>
    </DemoShell>
  );
}
