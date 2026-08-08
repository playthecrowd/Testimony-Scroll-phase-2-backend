import { notFound } from "next/navigation";
import Link from "next/link";
import { Shuffle, Play, Square, MessageSquare } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { SESSION, POV_BREAKOUT_GROUPS, findPerson } from "@/lib/workforceDemo";
import { NAMED_EMPLOYEE_IDS } from "@/lib/workforceDemoStore";

export const metadata = { title: "POV Breakouts — Plotabl Workforce (Demo)" };

// C6: Manager POV Breakouts. Mock-data-driven -- see POV_BREAKOUT_GROUPS in lib/workforceDemo.ts.
// Employee Participants & POV shows the same assignments read-only (no admin controls), per the
// acceptance test pairing.
export default function WorkforceDemoPovBreakoutsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const assignedIds = POV_BREAKOUT_GROUPS.flatMap((g) => g.memberIds);
  const unassigned = NAMED_EMPLOYEE_IDS.filter((id) => !assignedIds.includes(id));

  return (
    <DemoShell pageType="manager-pov-breakouts" searchPlaceholder="Search POV groups…">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">POV Breakouts</h1>
            <p className="text-sm text-muted mt-1">Assign participants to operational viewpoints and manage live breakout groups.</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Shuffle size={12} /> Auto-Assign</button>
            <button className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Play size={14} /> Launch Breakouts</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {POV_BREAKOUT_GROUPS.map((g) => (
            <div key={g.id} className="qk-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-sm font-semibold text-foreground">{g.name}</div>
                {g.live && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">LIVE</span>}
              </div>
              <p className="text-xs text-muted mb-3">{g.objective}</p>
              <div className="text-[11px] text-muted mb-1.5">{g.checkpoint}</div>
              <div className="space-y-2 mb-3">
                {g.memberIds.map((id) => {
                  const p = findPerson(id);
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" />
                      <span className="text-xs text-foreground">{p.name}</span>
                      <Link href={`/workforce/demo/my-session/FF-042/pov/${id}`} className="text-[11px] text-accent-blue hover:underline ml-auto">View Group</Link>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><MessageSquare size={10} /> Message Group</button>
                <button className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"><Square size={10} /> End Breakout</button>
              </div>
            </div>
          ))}
        </div>

        {unassigned.length > 0 && (
          <div className="qk-card rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Unassigned Participants</h2>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((id) => {
                const p = findPerson(id);
                return (
                  <span key={id} className="flex items-center gap-1.5 text-xs bg-surface-2 rounded-full pl-1 pr-2.5 py-1">
                    <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" /> {p.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DemoShell>
  );
}
