"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Share2, Trash2, Tag } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withMomentShared, withMomentDeleted } from "@/lib/workforceDemoStore";
import { SESSION } from "@/lib/workforceDemo";

const EMPLOYEE_ID = "ava-patel";

// D6: Employee Saved Moments. Mock-data-driven, employee's own moments only (filtered by
// personId) -- reads/writes the shared store, so sharing a moment here is what makes it appear in
// the Manager's Archive with `shared: true`, then flows on to the org-wide Evidence & Outcomes hub.
export default function WorkforceDemoSavedMomentsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();
  const mine = state.savedMoments.filter((m) => m.personId === EMPLOYEE_ID);

  return (
    <DemoShell pageType="my-session-saved-moments" searchPlaceholder="Search your saved moments…">
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saved Moments</h1>
          <p className="text-sm text-muted mt-1">Checkpoints, notes, and findings you&apos;ve captured this session.</p>
        </div>

        {mine.length === 0 ? (
          <div className="qk-card rounded-xl p-6 text-center text-xs text-muted">Nothing saved yet. Save a moment from the 3D World.</div>
        ) : (
          <div className="space-y-3">
            {mine.map((m) => (
              <div key={m.id} className="qk-card rounded-xl p-4 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground">{m.note}</div>
                  <div className="text-[11px] text-muted mt-1">{m.timestamp}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {m.shared ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue">Shared with Manager</span>
                  ) : (
                    <button onClick={() => update((s) => withMomentShared(s, m.id))} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Share2 size={10} /> Share with Manager</button>
                  )}
                  <div className="flex gap-1.5">
                    <button className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground"><Tag size={10} /> Tag</button>
                    {!m.shared && (
                      <button onClick={() => update((s) => withMomentDeleted(s, m.id))} className="flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"><Trash2 size={10} /> Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link href="/workforce/demo/my-session/FF-042/world" className="inline-block text-xs font-semibold text-accent-blue hover:underline">← Return to 3D World</Link>
      </div>
    </DemoShell>
  );
}
