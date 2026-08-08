"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Play, Check } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { SESSION, LEADERSHIP_CONTENT_ITEMS, findPerson } from "@/lib/workforceDemo";

// D5: Employee Leadership Content. Mock-data-driven -- reads live from the shared store, showing
// only items the Manager has released (LEADERSHIP_CONTENT_ITEMS filtered against
// leadershipContentStatus). Draft/withdrawn content never appears here, satisfying the acceptance
// test: "Release content as Manager and verify it appears; withdraw it and verify it no longer
// appears."
export default function WorkforceDemoEmployeeLeadershipContentPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state } = useWorkforceDemoStore();
  const released = LEADERSHIP_CONTENT_ITEMS.filter((c) => state.leadershipContentStatus[c.id] === "released");

  return (
    <DemoShell pageType="my-session-leadership-content" searchPlaceholder="Search leadership content…">
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leadership Content</h1>
          <p className="text-sm text-muted mt-1">Briefings and decision context released for this session.</p>
        </div>

        {released.length === 0 ? (
          <div className="qk-card rounded-xl p-6 text-center text-xs text-muted">Nothing has been released yet.</div>
        ) : (
          <div className="space-y-3">
            {released.map((c) => {
              const owner = findPerson(c.ownerId);
              return (
                <div key={c.id} className="qk-card rounded-xl p-4 flex items-center gap-3">
                  <span className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center shrink-0"><Play size={18} className="text-accent-blue" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <p className="text-xs text-muted mt-0.5">{c.summary}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted mt-1"><WorkforceAvatar name={owner.name} imageUrl={owner.portraitUrl} size="xs" /> {owner.name} · {c.format}</div>
                  </div>
                  <button className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors shrink-0 flex items-center gap-1"><Check size={11} /> Mark Complete</button>
                </div>
              );
            })}
          </div>
        )}

        <Link href="/workforce/demo/my-session/FF-042" className="inline-block text-xs font-semibold text-accent-blue hover:underline">← Return to My Session</Link>
      </div>
    </DemoShell>
  );
}
