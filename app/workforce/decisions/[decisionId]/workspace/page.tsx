import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getWorkforceAccess, listDepartments } from "@/services/supabase/workforce";
import { getDecision } from "@/services/supabase/workforceDecisions";
import {
  ensureDecisionStages,
  listDecisionStages,
  listStageTransitions,
  listDecisionFeedback,
} from "@/services/supabase/workforceStages";
import { listExperienceTemplates, listExperienceAssignments, listDepartmentManagers } from "@/services/supabase/workforceExperiences";
import { DecisionWorkspaceClient } from "@/components/workforce/DecisionWorkspaceClient";

export const dynamic = "force-dynamic";

// The destination of WF-02's "Track This Decision" -- WF-03 Pathway tracking plus the WF-04
// Department Breakout, combined into one page (the Contextual Decision Workspace menu's own
// section list is Phase 4+ scope to build out as real separate screens; this phase keeps the two
// most load-bearing sections on one page rather than standing up a tab-routing shell early).
export default async function WorkforceDecisionWorkspacePage({ params }: { params: Promise<{ decisionId: string }> }) {
  if (process.env.NEXT_PUBLIC_ENABLE_WORKFORCE_MODULE !== "true") notFound();

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (err) {
    if (err instanceof SupabaseConfigError) return <ErrorState message="Configuration error. Please try again later." />;
    throw err;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { decisionId } = await params;
  const decision = await getDecision(supabase, decisionId);
  if (!decision) notFound();

  await ensureDecisionStages(supabase, decision);

  const [access, stages, transitions, feedback, templates, assignments, departments] = await Promise.all([
    getWorkforceAccess(supabase, decision.churchId),
    listDecisionStages(supabase, decision.id),
    listStageTransitions(supabase, decision.id),
    listDecisionFeedback(supabase, decision.id),
    listExperienceTemplates(supabase),
    listExperienceAssignments(supabase, decision.id),
    listDepartments(supabase, decision.churchId),
  ]);

  const department = departments.find((d) => d.id === decision.departmentId) ?? null;
  const departmentManagers = decision.departmentId ? await listDepartmentManagers(supabase, decision.churchId, decision.departmentId) : [];
  const isDepartmentLeadership = access.roles.some((r) => r.role === "department_leadership" && r.departmentId === decision.departmentId);
  const canManageExperiences = access.isManager || decision.createdBy === user.id || isDepartmentLeadership;

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/workforce/decisions/${decision.id}`} className="text-xs text-accent-blue-light hover:underline">
          ← Back to Decision Preview
        </Link>
        <Link href={`/workforce/decisions?org=${decision.churchId}`} className="text-xs text-muted hover:underline">
          Back to Decision Pool
        </Link>
      </div>
      <DecisionWorkspaceClient
        decision={decision}
        stages={stages}
        transitions={transitions}
        feedback={feedback}
        templates={templates}
        assignments={assignments}
        department={department}
        departmentManagers={departmentManagers}
        canAdvance={access.isManager || decision.createdBy === user.id}
        isManager={access.isManager}
        canManageExperiences={canManageExperiences}
      />
    </div>
  );
}
