"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CornerDownRight } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforcePreviewRole } from "@/components/workforce/demo/RoleContext";
import { useWorkforceDemoStore } from "@/components/workforce/demo/StoreContext";
import { withFeedbackAdded, withFeedbackResolved } from "@/lib/workforceDemoStore";
import { DECISION, PATHWAY_STAGES, findPerson } from "@/lib/workforceDemo";
import { PREVIEW_ROLE_PERSON } from "@/lib/workforcePreviewRole";

// B2: Decision Feedback. Mock-data-driven, backed by the shared store's `feedbackComments` (not a
// static array) -- see PATHWAY_STAGES for stage tags. Adding a comment as one role and viewing it
// from another proves the acceptance test: "Add a manager comment tied to Management Planning and
// verify Department Leader sees it on the same decision feedback page."
export default function WorkforceDemoFeedbackPage() {
  const { role } = useWorkforcePreviewRole();
  const { state, update } = useWorkforceDemoStore();
  const [draft, setDraft] = useState("");
  const authorId = PREVIEW_ROLE_PERSON[role];

  function submit() {
    if (!draft.trim()) return;
    update((s) => withFeedbackAdded(s, authorId, draft.trim(), s.decisionStageIndex));
    setDraft("");
  }

  return (
    <DemoShell pageType="decision-feedback" searchPlaceholder="Search feedback…">
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href="/workforce/demo/decisions/D-2048/workspace" className="hover:text-accent-blue">{DECISION.title}</Link> / Feedback
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Decision Feedback</h1>
          <p className="text-sm text-muted mt-1">A dedicated feedback workspace for {DECISION.title}.</p>
        </div>

        <div className="qk-card rounded-2xl p-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add feedback tied to the current stage…"
            className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm focus-ring resize-none"
            rows={2}
          />
          <div className="flex justify-end mt-2">
            <button onClick={submit} className="text-xs font-semibold px-4 py-2 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Add Feedback</button>
          </div>
        </div>

        <div className="space-y-3">
          {state.feedbackComments.map((c) => {
            const p = findPerson(c.personId);
            return (
              <div key={c.id} className={`qk-card rounded-xl p-4 ${c.resolved ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="text-[10px] text-muted">{c.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-accent-blue mb-1">{PATHWAY_STAGES[c.stageIndex]}</div>
                    <p className="text-sm text-foreground">{c.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground"><CornerDownRight size={11} /> Reply</button>
                      <button onClick={() => update((s) => withFeedbackResolved(s, c.id))} className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground">
                        <Check size={11} /> {c.resolved ? "Reopen" : "Mark Resolved"}
                      </button>
                    </div>
                  </div>
                  {c.resolved && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue shrink-0">Resolved</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DemoShell>
  );
}
