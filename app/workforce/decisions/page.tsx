import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyWorkforceOrganizations, getWorkforceAccess, getMyProfileName, getRoleBadgeLabel } from "@/services/supabase/workforce";
import { DecisionPoolClient } from "@/components/workforce/DecisionPoolClient";
import { WorkforceAppShell } from "@/components/workforce/WorkforceAppShell";

export const dynamic = "force-dynamic";

// WF-01 Decision Pool Catalog. Org is chosen via ?org=<churchId>, defaulting to the profile's
// first reachable org.
export default async function WorkforceDecisionsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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

  const { org: orgParam } = await searchParams;
  const organizations = await getMyWorkforceOrganizations(supabase);
  if (organizations.length === 0) redirect("/workforce/access-pending");

  const org = organizations.find((o) => o.churchId === orgParam) ?? organizations[0];
  const [access, userName] = await Promise.all([getWorkforceAccess(supabase, org.churchId), getMyProfileName(supabase)]);
  const canCreate = access.isManager || access.roles.some((r) => r.role === "stakeholder");

  return (
    <WorkforceAppShell
      churchId={org.churchId}
      orgName={org.name}
      userName={userName ?? "You"}
      roleLabel={getRoleBadgeLabel(access)}
      isManager={access.isManager}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <DecisionPoolClient churchId={org.churchId} orgName={org.name} canCreate={canCreate} />
      </div>
    </WorkforceAppShell>
  );
}
