"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Bookmark, MessageSquare, HelpCircle, LogOut, Users } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withCheckpointCompleted, withMomentSaved } from "@/lib/workforceDemoStore";
import { DECISION, SESSION, POV_BREAKOUT_GROUPS } from "@/lib/workforceDemo";

const EMPLOYEE_ID = "ava-patel";

// D2: Employee 3D World. Mock-data-driven, wired to the shared store -- "Complete Checkpoint" and
// "Save Moment" are real mutations, satisfying the acceptance test: "Complete a checkpoint, save a
// moment, switch to Manager, and verify both actions are visible" (on Manager Session Analytics
// and Manager Recordings & Archive respectively).
export default function WorkforceDemoMyWorldPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();
  const [note, setNote] = useState("");
  const myGroup = POV_BREAKOUT_GROUPS.find((g) => g.memberIds.includes(EMPLOYEE_ID));

  function saveMoment() {
    if (!note.trim()) return;
    update((s) => withMomentSaved(s, EMPLOYEE_ID, note.trim()));
    setNote("");
  }

  return (
    <DemoShell pageType="my-session-world" searchPlaceholder="Search sessions, participants, decisions…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">{SESSION.title}</h1>
              <p className="text-xs text-muted mt-1">Current Objective: Verify workflow sequence and identify readiness gaps.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/workforce/demo/my-session/FF-042/participants-pov" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors flex items-center gap-1"><Users size={12} /> Participants & POV</Link>
              <Link href="/workforce/demo/my-session/FF-042/help" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors flex items-center gap-1"><HelpCircle size={12} /> Ask for Help</Link>
              <Link href="/workforce/demo/my-session/FF-042" className="text-xs font-medium px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"><LogOut size={12} /> Exit Session</Link>
            </div>
          </div>

          <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
            <Image src={DECISION.heroImageUrl} alt="3D World" fill className="object-cover" priority />
            <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">Mobile Avatar World</span>
            <div className="absolute top-1/3 left-[20%] flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-blue ring-4 ring-accent-blue/30" />
              <span className="mt-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-black/70 text-white">Inspection Point A</span>
            </div>
          </div>

          <div className="qk-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground">Checkpoint Progress</h2>
              <span className="text-xs text-muted tabular-nums">{state.checkpointsCompleted} of {state.totalCheckpoints}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-3">
              <div className="h-full bg-accent-blue rounded-full" style={{ width: `${(state.checkpointsCompleted / state.totalCheckpoints) * 100}%` }} />
            </div>
            {state.checkpointsCompleted < state.totalCheckpoints ? (
              <button onClick={() => update(withCheckpointCompleted)} className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Complete Checkpoint</button>
            ) : (
              <span className="text-xs text-accent-blue flex items-center gap-1"><Check size={12} /> All checkpoints complete</span>
            )}
          </div>

          <div className="qk-card rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Add a Note or Save a Moment</h2>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you observe?" rows={2} className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm focus-ring resize-none" />
            <div className="flex justify-end gap-2 mt-2">
              <button className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors flex items-center gap-1"><MessageSquare size={11} /> Add Note</button>
              <button onClick={saveMoment} className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors flex items-center gap-1"><Bookmark size={11} /> Save Moment</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Assigned POV Group</h3>
            {myGroup ? (
              <>
                <div className="text-sm font-semibold text-foreground">{myGroup.name}</div>
                <p className="text-xs text-muted mt-1">{myGroup.objective}</p>
              </>
            ) : (
              <p className="text-xs text-muted">Not yet assigned to a POV group.</p>
            )}
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Decision Context</h3>
            <p className="text-xs text-foreground">{DECISION.executiveIntent}</p>
            <Link href="/workforce/demo/my-session/FF-042" className="text-xs text-accent-blue hover:underline mt-2 inline-block">View Full Decision Context →</Link>
          </div>
          <div className="qk-card rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">My Saved Moments</h3>
            {state.savedMoments.filter((m) => m.personId === EMPLOYEE_ID).length === 0 ? (
              <p className="text-xs text-muted">None yet this session.</p>
            ) : (
              <div className="space-y-1.5">
                {state.savedMoments.filter((m) => m.personId === EMPLOYEE_ID).slice(0, 3).map((m) => (
                  <p key={m.id} className="text-xs text-foreground">{m.note}</p>
                ))}
              </div>
            )}
            <Link href="/workforce/demo/my-session/FF-042/saved-moments" className="text-xs text-accent-blue hover:underline mt-2 inline-block">View All Saved Moments →</Link>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
