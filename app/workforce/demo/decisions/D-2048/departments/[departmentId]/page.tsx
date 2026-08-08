import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, X, Users, UsersRound } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { DECISION, EXPERIENCE_USE_CASES, SELECTED_EXPERIENCE_TITLE, findPerson, findDepartment } from "@/lib/workforceDemo";

export const metadata = { title: "Department Breakout — Plotabl Workforce (Demo)" };

// WF-04: Department Experience Catalog. Mock-data-driven -- see lib/workforceDemo.ts. The 4-step
// role track (Stakeholder -> Department Leadership -> Managers -> Employees) uses real portrait
// photos at the completed/current steps per the reference screenshot, not icon placeholders. The
// experience grid here is a summary (top 4) linking out to the standalone Experience Catalog page
// -- Assigned Managers and Proposals are now their own distinct department-management pages, not
// links reused from the session-scoped Manager tree.
export default async function WorkforceDemoDepartmentBreakoutPage({ params }: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await params;
  let department;
  try {
    department = findDepartment(departmentId);
  } catch {
    notFound();
  }
  const stakeholder = findPerson(DECISION.decisionOwnerId);
  const deptLead = findPerson(DECISION.departmentLeaderId);
  const navContext = { decisionId: DECISION.id, departmentId: department.id, sessionId: "FF-042" };

  return (
    <DemoShell
      pageType="department-breakout"
      navContext={navContext}
      searchPlaceholder="Search decisions, people, experiences…"
      navFooter={
        <Link href="/workforce/demo/decisions/D-2048" className="text-xs text-accent-blue hover:underline px-3 py-2 block">← Back to Decision Preview</Link>
      }
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{DECISION.title}</h1>
              <p className="text-sm text-muted">{department.name} Department</p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-blue/15 text-accent-blue h-fit">{DECISION.statusLabel}</span>
          </div>

          <div className="qk-card rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <RoleStep name={stakeholder.name} portrait={stakeholder.portraitUrl} label="Stakeholder" sub="Complete" state="done" />
              <div className="flex-1 h-px bg-border-subtle" />
              <RoleStep name={deptLead.name} portrait={deptLead.portraitUrl} label="Department Leadership" sub="You are here" state="active" />
              <div className="flex-1 h-px bg-border-subtle" />
              <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}/managers`} className="contents">
                <RoleStep label="Managers" sub={`${DECISION.audience.managers} awaiting assignment`} state="upcoming" icon={Users} />
              </Link>
              <div className="flex-1 h-px bg-border-subtle" />
              <RoleStep label="Employees" sub={`${DECISION.audience.employees} pending activation`} state="upcoming" icon={UsersRound} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border-subtle text-xs">
              <div><div className="text-muted mb-0.5">Department Objective</div><div className="text-foreground font-medium">Translate intent into role-ready experiences</div></div>
              <div><div className="text-muted mb-0.5">Audience</div><div className="text-foreground font-medium">{DECISION.audience.managers} managers · {DECISION.audience.employees} employees · {DECISION.audience.interns} interns</div></div>
              <div><div className="text-muted mb-0.5">Required Outcomes</div><div className="text-foreground font-medium">Role readiness, safe adoption</div></div>
              <div><div className="text-muted mb-0.5">Leadership Actions</div><div className="text-foreground font-medium">Select experience → Assign managers</div></div>
            </div>
            <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-border-subtle">
              <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}/managers`} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                Assigned Managers
              </Link>
              <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}/proposals`} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
                Proposals
              </Link>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Future Factory Experience Catalog</h2>
                <p className="text-sm text-muted mt-1">Select a purpose-built experience to help your managers communicate, demonstrate, train, or validate this decision.</p>
              </div>
              <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}/experiences`} className="text-xs font-semibold text-accent-blue hover:underline shrink-0">View Full Catalog →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {EXPERIENCE_USE_CASES.slice(0, 4).map((exp) => {
                const selected = exp.title === SELECTED_EXPERIENCE_TITLE;
                return (
                  <div key={exp.title} className={`qk-card rounded-xl p-3.5 ${selected ? "ring-2 ring-accent-blue" : ""}`}>
                    {exp.recommended && (
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold mb-2">Recommended</span>
                    )}
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">{exp.capability}</div>
                    <div className="text-sm font-semibold text-foreground mb-1">{exp.title}</div>
                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue mb-2">{exp.focus}</span>
                    <p className="text-xs text-muted mb-3">{exp.description}</p>
                    <div className="text-[11px] text-muted mb-2.5">{exp.durationMin} min · Ready</div>
                    <div className="flex gap-2">
                      <Link href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}/experiences`} className="flex-1 text-center text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">Preview</Link>
                      <Link
                        href={`/workforce/demo/decisions/${DECISION.id}/departments/${department.id}/experiences`}
                        className={`flex-1 text-center text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${selected ? "bg-accent-blue text-[#16210a]" : "border border-accent-blue text-accent-blue hover:bg-accent-blue/10"}`}
                      >
                        {selected ? "Selected" : "Select & Assign"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="qk-card rounded-2xl p-4 sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Selected Experience</h2>
            <X size={15} className="text-muted" />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-accent-gold mb-1">Screen Ride & Simulator</div>
          <div className="text-sm font-semibold text-foreground mb-1">{SELECTED_EXPERIENCE_TITLE}</div>
          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue mb-4">Skills Training</span>
          <div className="text-xs text-muted mb-1.5">Assign to Managers</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["jordan-brooks", "priya-shah", "daniel-ruiz"].map((id) => {
              const p = findPerson(id);
              return (
                <span key={id} className="flex items-center gap-1.5 text-xs bg-surface-2 rounded-full pl-1 pr-2 py-1">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="xs" /> {p.name}
                </span>
              );
            })}
          </div>
          <Link
            href="/workforce/demo/vendor/requests/VR-104"
            className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors mb-2"
          >
            <Sparkles size={14} /> Customize with Plotabl
          </Link>
          <Link
            href="/workforce/demo/proposals/new"
            className="block text-center text-sm font-medium px-4 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors"
          >
            Create Session Proposal
          </Link>
          <p className="text-[11px] text-muted mt-3">Plotabl and approved delivery partners will scope and produce the custom experience after approval.</p>
        </div>
      </div>
    </DemoShell>
  );
}

function RoleStep({
  name,
  portrait,
  label,
  sub,
  state,
  icon: Icon,
}: {
  name?: string;
  portrait?: string | null;
  label: string;
  sub: string;
  state: "done" | "active" | "upcoming";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center min-w-[110px]">
      {name ? (
        <WorkforceAvatar name={name} imageUrl={portrait} size="lg" className={state === "active" ? "ring-4 ring-accent-blue/30" : ""} />
      ) : (
        <span className={`w-14 h-14 rounded-full flex items-center justify-center ${state === "active" ? "bg-accent-blue/15 ring-4 ring-accent-blue/20" : "bg-surface-2"}`}>
          {Icon && <Icon size={20} className="text-muted" />}
        </span>
      )}
      <div className={`text-xs font-semibold ${state === "active" ? "text-accent-blue" : "text-foreground"}`}>{name ?? label}</div>
      {name && <div className="text-[10px] text-muted">{label}</div>}
      <div className={`text-[10px] ${state === "done" ? "text-accent-blue" : "text-muted"}`}>{sub}</div>
    </div>
  );
}
