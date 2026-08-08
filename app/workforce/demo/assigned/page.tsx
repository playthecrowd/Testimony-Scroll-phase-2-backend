"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoShell } from "@/components/workforce/demo/DemoShell";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforcePreviewRole } from "@/components/workforce/demo/RoleContext";
import { WORKFORCE_ASSIGNMENTS, findPerson } from "@/lib/workforceDemo";

const SECTIONS = [
  { key: "needs_action", label: "Needs Action" },
  { key: "upcoming", label: "Upcoming" },
  { key: "waiting_on_others", label: "Waiting on Others" },
  { key: "completed", label: "Completed" },
] as const;

// A2: Assigned to Me. Mock-data-driven, role-scoped action queue -- see WORKFORCE_ASSIGNMENTS in
// lib/workforceDemo.ts. Only items tagged with the active preview role are shown, and each opens
// its real object (proposal, session, decision, or department page), never a placeholder.
export default function WorkforceDemoAssignedPage() {
  const { role } = useWorkforcePreviewRole();
  const items = WORKFORCE_ASSIGNMENTS.filter((a) => a.roles.includes(role));

  return (
    <DemoShell pageType="assigned-to-me" searchPlaceholder="Search assignments…">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assigned to Me</h1>
          <p className="text-sm text-muted mt-1">Decisions, proposals, sessions, and reviews assigned to your current role.</p>
        </div>

        {SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.status === section.key);
          return (
            <div key={section.key}>
              <h2 className="text-sm font-semibold text-foreground mb-3">{section.label} <span className="text-muted font-normal">({sectionItems.length})</span></h2>
              {sectionItems.length === 0 ? (
                <div className="qk-card rounded-xl p-5 text-center text-xs text-muted">Nothing here right now.</div>
              ) : (
                <div className="space-y-2.5">
                  {sectionItems.map((item) => {
                    const assignedBy = findPerson(item.assignedById);
                    return (
                      <Link key={item.id} href={item.href} className="qk-card rounded-xl p-4 flex flex-wrap items-center gap-3 hover:border-accent-blue/50 transition-colors group">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-blue">{item.type.replace("_", " ")}</span>
                            <span className="text-[10px] text-muted">{item.relatedLabel}</span>
                          </div>
                          <div className="text-sm font-semibold text-foreground group-hover:text-accent-blue transition-colors">{item.title}</div>
                          <div className="text-xs text-muted mt-0.5">{item.expectedAction}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted">
                          <span className="flex items-center gap-1.5"><WorkforceAvatar name={assignedBy.name} imageUrl={assignedBy.portraitUrl} size="xs" /> {assignedBy.name}</span>
                          <span>Due {item.dueDate}</span>
                          <ArrowRight size={14} className="text-accent-blue" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DemoShell>
  );
}
