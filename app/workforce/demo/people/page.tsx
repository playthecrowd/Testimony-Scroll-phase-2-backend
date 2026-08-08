"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { PEOPLE, DEPARTMENTS, findDepartment } from "@/lib/workforceDemo";

const ROLE_LABEL: Record<string, string> = {
  platform_owner: "Platform Owner",
  module_owner: "Enterprise Owner",
  stakeholder: "Decision Owner",
  department_leadership: "Department Leader",
  manager: "Manager",
  employee: "Employee",
  intern: "Intern",
  vendor: "Vendor",
};

// A5: People & Teams. Mock-data-driven -- see PEOPLE/DEPARTMENTS in lib/workforceDemo.ts. Teams
// are derived from the 3 real departments rather than a separate fabricated team dataset, so
// counts stay consistent with what Department Breakout already shows.
export default function WorkforceDemoPeoplePage() {
  const [tab, setTab] = useState<"people" | "teams">("people");

  return (
    <DemoShell pageType="people" searchPlaceholder="Search people, roles, departments, or teams…">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">People & Teams</h1>
          <p className="text-sm text-muted mt-1">The shared directory used by assignments, proposals, invitations, and session participation.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setTab("people")} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${tab === "people" ? "bg-accent-blue text-[#16210a]" : "bg-surface-2 text-muted hover:text-foreground"}`}>People</button>
          <button onClick={() => setTab("teams")} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${tab === "teams" ? "bg-accent-blue text-[#16210a]" : "bg-surface-2 text-muted hover:text-foreground"}`}>Teams</button>
        </div>

        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input disabled placeholder="Search by person, role, department, team, site, or shift" className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-8 pr-3 py-2 text-xs focus-ring" />
        </div>

        {tab === "people" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PEOPLE.filter((p) => p.role !== "platform_owner").map((p) => {
              const dept = p.departmentId ? findDepartment(p.departmentId) : null;
              return (
                <div key={p.id} className="qk-card rounded-xl p-3.5 flex items-center gap-3">
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-[11px] text-muted truncate">{p.title}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue">{ROLE_LABEL[p.role]}</span>
                      {dept && <span className="text-[10px] text-muted">{dept.name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept) => {
              const members = PEOPLE.filter((p) => p.departmentId === dept.id);
              const leader = members.find((m) => m.role === "department_leadership") ?? members.find((m) => m.role === "manager");
              return (
                <div key={dept.id} className="qk-card rounded-xl p-4">
                  <div className="text-sm font-semibold text-foreground mb-1">{dept.name}</div>
                  {leader && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <WorkforceAvatar name={leader.name} imageUrl={leader.portraitUrl} size="xs" />
                      <span className="text-xs text-muted">Led by {leader.name}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-muted mb-2">{members.length} members · {members.filter((m) => m.role === "manager").length} managers · {members.filter((m) => m.role === "employee").length} employees</div>
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 6).map((m) => (
                      <WorkforceAvatar key={m.id} name={m.name} imageUrl={m.portraitUrl} size="xs" className="ring-2 ring-surface" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DemoShell>
  );
}
