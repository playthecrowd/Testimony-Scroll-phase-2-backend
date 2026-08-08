import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Users, Coins } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { DECISION, EXPERIENCE_USE_CASES, SELECTED_EXPERIENCE_TITLE, findDepartment } from "@/lib/workforceDemo";

export const metadata = { title: "Experience Catalog — Plotabl Workforce (Demo)" };

// B3: Department Experience Catalog. Mock-data-driven -- see EXPERIENCE_USE_CASES in
// lib/workforceDemo.ts. Standalone page (previously only a summary grid embedded in Department
// Breakout) so "Experience Catalog" has a real distinct destination, per the department leader's
// own nav tab.
export default async function WorkforceDemoExperienceCatalogPage({ params }: { params: Promise<{ decisionId: string; departmentId: string }> }) {
  const { departmentId } = await params;
  let department;
  try {
    department = findDepartment(departmentId);
  } catch {
    notFound();
  }
  const navContext = { decisionId: DECISION.id, departmentId: department.id, sessionId: "FF-042" };

  return (
    <DemoShell pageType="department-experiences" navContext={navContext} searchPlaceholder="Search experiences by capability or focus…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="text-xs text-muted">
          <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}`} className="hover:text-accent-blue">{department.name} Department</Link> / Experience Catalog
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Future Factory Experience Catalog</h1>
          <p className="text-sm text-muted mt-1">Experiences suitable for {DECISION.title} in {department.name}.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs qk-card rounded-xl p-4">
            <div><div className="text-muted mb-0.5">Objective</div><div className="text-foreground font-medium">Translate intent into role-ready experiences</div></div>
            <div><div className="text-muted mb-0.5">Audience</div><div className="text-foreground font-medium">{DECISION.audience.managers} managers · {DECISION.audience.employees} employees</div></div>
            <div><div className="text-muted mb-0.5">Required Outcomes</div><div className="text-foreground font-medium">Role readiness, safe adoption</div></div>
            <div><div className="text-muted mb-0.5">Readiness Needs</div><div className="text-foreground font-medium">Floor activation by Oct 24</div></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPERIENCE_USE_CASES.map((exp) => {
            const selected = exp.title === SELECTED_EXPERIENCE_TITLE;
            return (
              <div key={exp.title} className={`qk-card rounded-xl p-4 ${selected ? "ring-2 ring-accent-blue" : ""}`}>
                {exp.recommended && <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold mb-2">Recommended</span>}
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">{exp.capability}</div>
                <div className="text-sm font-semibold text-foreground mb-1">{exp.title}</div>
                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue mb-2">{exp.focus}</span>
                <p className="text-xs text-muted mb-3">{exp.description}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted mb-3">
                  <span className="flex items-center gap-1"><Clock size={11} /> {exp.durationMin} min</span>
                  <span className="flex items-center gap-1"><Users size={11} /> {exp.capacity}</span>
                  <span className="flex items-center gap-1"><Coins size={11} /> {exp.creditCost}</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Preview</button>
                  <button className="flex-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Compare</button>
                </div>
                <Link
                  href="/workforce/demo/proposals/new"
                  className={`block text-center mt-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${selected ? "bg-accent-blue text-[#16210a]" : "border border-accent-blue text-accent-blue hover:bg-accent-blue/10"}`}
                >
                  {selected ? "Selected — Manage Assignment" : "Select & Assign"}
                </Link>
              </div>
            );
          })}
        </div>

        <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}`} className="inline-block text-xs font-semibold text-accent-blue hover:underline">← Return to Department Workspace</Link>
      </div>
    </DemoShell>
  );
}
