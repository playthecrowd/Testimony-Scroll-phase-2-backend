"use client";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { use, useState } from "react";
import { Check, Info, AlertTriangle, HelpCircle as HelpCircleIcon, Bookmark } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withMomentSaved } from "@/lib/workforceDemoStore";
import { DECISION, SESSION, findPerson } from "@/lib/workforceDemo";

const NOTES = [
  { icon: Check, body: "Gathering visual confirmation on fan case inspection.", time: "10:15:22" },
  { icon: Info, body: "Inspection step confirmed. No issues observed.", time: "10:16:08" },
  { icon: AlertTriangle, body: "Tool access could be improved on lower bracket.", time: "10:16:45" },
  { icon: HelpCircleIcon, body: "Is safety lockout required before seal check?", time: "10:17:12" },
];

// D4: Employee POV Detail. Mock-data-driven -- migrated from the old fixed
// /sessions/FF-042/pov/[participantId]. Only "ava-patel" resolves in this checkpoint (the sole
// VR-live participant), matching the acceptance test's id-preservation requirement; other ids
// correctly 404 rather than exposing another participant's private notes.
export default function WorkforceDemoMyPovDetailPage({ params }: { params: Promise<{ sessionId: string; participantId: string }> }) {
  const { participantId } = use(params);
  if (SESSION.id !== "FF-042" || participantId !== "ava-patel") notFound();
  const p = findPerson("ava-patel");
  const { update } = useWorkforceDemoStore();
  const [note, setNote] = useState("");

  function saveMoment() {
    if (!note.trim()) return;
    update((s) => withMomentSaved(s, "ava-patel", note.trim()));
    setNote("");
  }

  return (
    <DemoShell pageType="my-session-pov" searchPlaceholder="Search sessions, participants, decisions…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted"><Link href="/workforce/demo/my-session/FF-042/participants-pov" className="hover:text-accent-blue">Participants & POV</Link> / {p.name}</div>
            <h1 className="text-xl font-bold text-foreground">{p.name} — My Live POV</h1>
          </div>
          <Link href="/workforce/demo/my-session/FF-042/participants-pov" className="text-xs font-medium px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Return to Participants & POV</Link>
        </div>

        <div className="relative w-full aspect-video rounded-2xl overflow-hidden max-w-[1000px]">
          <Image src={DECISION.thumbnailUrl} alt="Live POV" fill className="object-cover" />
          <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white">Live POV</span>
        </div>

        <div className="qk-card rounded-2xl p-4 max-w-[1000px]">
          <h2 className="text-sm font-semibold text-foreground mb-3">Notes & Findings</h2>
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
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Save a relevant moment…" className="flex-1 bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs focus-ring" />
            <button onClick={saveMoment} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Bookmark size={12} /> Save Moment</button>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
