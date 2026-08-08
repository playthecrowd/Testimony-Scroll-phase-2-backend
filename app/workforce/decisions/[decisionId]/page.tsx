import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getWorkforceAccess, listDepartments, getMyProfileName, getRoleBadgeLabel, getMyWorkforceOrganizations } from "@/services/supabase/workforce";
import { getDecision, listDecisions, getDecisionParticipants, listInvitationRequests } from "@/services/supabase/workforceDecisions";
import { WorkforceDecisionPreview } from "@/components/workforce/WorkforceDecisionPreview";
import { WorkforceAppShell } from "@/components/workforce/WorkforceAppShell";

export const dynamic = "force-dynamic";

// WF-02 Stakeholder Decision Preview.
export default async function WorkforceDecisionPreviewPage({ params }: { params: Promise<{ decisionId: string }> }) {
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
  if (!user) redirect("/workforce/login");

  const { decisionId } = await params;
  const decision = await getDecision(supabase, decisionId);
  // RLS returns no row at all for a decision this profile can't see -- indistinguishable from
  // "doesn't exist," which is the correct behavior here (no leaking existence of a restricted
  // decision to someone outside its visibility set).
  if (!decision) notFound();

  const [access, participants, invitationRequests, departments, allDecisions, userName, organizations] = await Promise.all([
    getWorkforceAccess(supabase, decision.churchId),
    getDecisionParticipants(supabase, decision.id),
    listInvitationRequests(supabase, decision.id),
    listDepartments(supabase, decision.churchId),
    listDecisions(supabase, decision.churchId),
    getMyProfileName(supabase),
    getMyWorkforceOrganizations(supabase),
  ]);
  const orgName = organizations.find((o) => o.churchId === decision.churchId)?.name ?? "";
  const otherDecisions = allDecisions.filter((d) => d.id !== decision.id).slice(0, 12);

  return (
    <WorkforceAppShell
      churchId={decision.churchId}
      orgName={orgName}
      userName={userName ?? "You"}
      roleLabel={getRoleBadgeLabel(access)}
      isManager={access.isManager}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <WorkforceDecisionPreview
          decision={decision}
          participants={participants}
          invitationRequests={invitationRequests}
          departments={departments}
          isManager={access.isManager}
          canReview={access.isManager}
          otherDecisions={otherDecisions}
          totalDecisionsCount={allDecisions.length}
        />
      </div>
    </WorkforceAppShell>
  );
}
