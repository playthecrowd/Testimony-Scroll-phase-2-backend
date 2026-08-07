"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { listDecisions, DecisionFilters } from "@/services/supabase/workforceDecisions";
import { listDepartments } from "@/services/supabase/workforce";
import { WorkforceDecision, WorkforceDepartment } from "@/types";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { Button } from "@/components/ui/Button";
import { DecisionCard } from "./DecisionCard";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "stakeholder_review", label: "Stakeholder Review" },
  { value: "awaiting_leadership_approval", label: "Awaiting Leadership Approval" },
  { value: "department_translation", label: "Department Translation" },
  { value: "management_planning", label: "Management Planning" },
  { value: "employee_activation", label: "Employee Activation" },
  { value: "in_implementation", label: "In Implementation" },
  { value: "measuring_outcomes", label: "Measuring Outcomes" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "archived", label: "Archived" },
];

// WF-01 Decision Pool Catalog. Client-driven filtering (re-queries on every change, RLS-scoped)
// rather than URL-searchParam-driven -- matches this codebase's existing pattern for
// interactive/authenticated listing screens rather than the public, shareable-URL listing pages.
export function DecisionPoolClient({ churchId, orgName, canCreate }: { churchId: string; orgName: string; canCreate: boolean }) {
  const [decisions, setDecisions] = useState<WorkforceDecision[] | null>(null);
  const [departments, setDepartments] = useState<WorkforceDepartment[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [scope, setScope] = useState<"all" | "mine" | "assigned">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const supabase = createClient();
        const filters: DecisionFilters = {
          search: search.trim() || undefined,
          status: status || undefined,
          departmentId: departmentId || undefined,
          mine: scope === "mine",
          assignedToMe: scope === "assigned",
        };
        const [decisionRows, departmentRows] = await Promise.all([
          listDecisions(supabase, churchId, filters),
          listDepartments(supabase, churchId),
        ]);
        if (cancelled) return;
        setDecisions(decisionRows);
        setDepartments(departmentRows);
      } catch {
        if (!cancelled) setError("Something went wrong loading decisions. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [churchId, search, status, departmentId, scope]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Decision Pool</h1>
          <p className="text-muted text-sm mt-1">Track decisions from stakeholder intent through workforce implementation. {orgName}</p>
        </div>
        {canCreate && (
          <Link href={`/workforce/decisions/new?org=${churchId}`}>
            <Button>New Decision</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search decisions, owners, or stakeholders..."
          className="flex-1 min-w-[220px] bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
          className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Decisions</option>
          <option value="mine">My Decisions</option>
          <option value="assigned">Assigned to Me</option>
        </select>
      </div>

      {error && <ErrorState message={error} />}
      {!error && decisions === null && <LoadingState label="Loading decisions..." />}
      {!error && decisions !== null && decisions.length === 0 && <EmptyState message="No decisions match these filters." />}
      {!error && decisions !== null && decisions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {decisions.map((d) => (
            <DecisionCard key={d.id} decision={d} />
          ))}
        </div>
      )}
    </div>
  );
}
