import { notFound } from "next/navigation";
import { Play, Eye, Pencil, Calendar, ClipboardCheck, Send } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { SESSION, SESSION_ASSESSMENTS } from "@/lib/workforceDemo";

export const metadata = { title: "Assessments — Plotabl Workforce (Demo)" };

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-surface-2 text-muted",
  scheduled: "bg-amber-100 text-amber-700",
  live: "bg-accent-blue/15 text-accent-blue",
  closed: "bg-surface-2 text-muted",
  scored: "bg-accent-gold/15 text-accent-gold",
  published: "bg-green-100 text-green-700",
};

// C5: Manager Assessments. Mock-data-driven -- see SESSION_ASSESSMENTS in lib/workforceDemo.ts.
export default function WorkforceDemoManagerAssessmentsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  void params;
  if (SESSION.id !== "FF-042") notFound();

  return (
    <DemoShell pageType="manager-assessments" searchPlaceholder="Search assessments…">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assessments</h1>
            <p className="text-sm text-muted mt-1">Prepare, release, monitor, and score assessments for {SESSION.title}.</p>
          </div>
          <button className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors">Create Assessment</button>
        </div>

        <div className="space-y-3">
          {SESSION_ASSESSMENTS.map((a) => (
            <div key={a.id} className="qk-card rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{a.title}</div>
                  <p className="text-xs text-muted mt-0.5">{a.purpose}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 capitalize ${STATUS_STYLE[a.status]}`}>{a.status}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-[11px] text-muted mb-3">
                <span>{a.questionCount} questions</span>
                <span>{a.participantScope}</span>
                <span>{a.responseCount} responses</span>
                <span>{a.completionPercent}% complete</span>
                {a.avgScore !== null && <span>Avg score {a.avgScore}%</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Eye size={11} /> Preview</button>
                <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Pencil size={11} /> Edit</button>
                {a.status === "draft" && (
                  <>
                    <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"><Calendar size={11} /> Schedule</button>
                    <button className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Play size={11} /> Launch</button>
                  </>
                )}
                {a.status === "scored" && (
                  <button className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"><Send size={11} /> Publish Results</button>
                )}
                {a.status === "published" && (
                  <span className="flex items-center gap-1 text-xs text-accent-blue"><ClipboardCheck size={11} /> Published to Session Analytics</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoShell>
  );
}
