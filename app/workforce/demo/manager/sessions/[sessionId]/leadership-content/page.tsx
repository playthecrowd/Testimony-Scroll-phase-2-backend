"use client";

import { notFound } from "next/navigation";
import { Play, Send, Undo2, Eye } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withContentReleased, withContentWithdrawn } from "@/lib/workforceDemoStore";
import { SESSION, LEADERSHIP_CONTENT_ITEMS, findPerson } from "@/lib/workforceDemo";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-surface-2 text-muted",
  released: "bg-accent-blue/15 text-accent-blue",
  withdrawn: "bg-red-100 text-red-700",
};

// C7: Manager Leadership Content. Mock-data-driven, wired to the shared store's
// `leadershipContentStatus` -- only "released" items appear on the Employee Leadership Content
// page (D5), matching the acceptance test: "Release ... and verify it appears for the Employee
// role; withdraw it and verify it no longer appears."
export default function WorkforceDemoManagerLeadershipContentPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();
  const { state, update } = useWorkforceDemoStore();

  return (
    <DemoShell pageType="manager-leadership-content" searchPlaceholder="Search leadership content…">
      <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leadership Content</h1>
          <p className="text-sm text-muted mt-1">Prepare, preview, and release leadership briefings to participants.</p>
        </div>

        <div className="space-y-3">
          {LEADERSHIP_CONTENT_ITEMS.map((item) => {
            const owner = findPerson(item.ownerId);
            const status = state.leadershipContentStatus[item.id] ?? "draft";
            return (
              <div key={item.id} className="qk-card rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <p className="text-xs text-muted mt-0.5">{item.summary}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 capitalize ${STATUS_STYLE[status]}`}>{status}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted mb-3">
                  <span className="flex items-center gap-1"><WorkforceAvatar name={owner.name} imageUrl={owner.portraitUrl} size="xs" /> {owner.name}</span>
                  <span>{item.format}</span>
                  <span>{item.viewedCount} views</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Play size={11} /> Preview</button>
                  {status !== "released" ? (
                    <button onClick={() => update((s) => withContentReleased(s, item.id))} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Send size={11} /> Release Now</button>
                  ) : (
                    <button onClick={() => update((s) => withContentWithdrawn(s, item.id))} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"><Undo2 size={11} /> Withdraw</button>
                  )}
                  <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Eye size={11} /> View Employee Version</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DemoShell>
  );
}
