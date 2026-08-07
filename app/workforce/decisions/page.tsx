import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { getMyWorkforceOrganizations, getWorkforceAccess } from "@/services/supabase/workforce";
import { DecisionPoolClient } from "@/components/workforce/DecisionPoolClient";

export const dynamic = "force-dynamic";

// WF-01 Decision Pool Catalog. Org is chosen via ?org=<churchId>, defaulting to the profile's
// first reachable org -- same reasoning as app/workforce/page.tsx (no org switcher UI yet, this is
// still Phase 2 scaffolding, not the polished module chrome).
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
  if (!user) redirect("/login");

  const { org: orgParam } = await searchParams;
  const organizations = await getMyWorkforceOrganizations(supabase);
  if (organizations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <EmptyState message="Plotabl Workforce isn't available on your account yet." />
      </div>
    );
  }

  const org = organizations.find((o) => o.churchId === orgParam) ?? organizations[0];
  const access = await getWorkforceAccess(supabase, org.churchId);
  const canCreate = access.isManager || access.roles.some((r) => r.role === "stakeholder");

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      {organizations.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {organizations.map((o) => (
            <Link
              key={o.churchId}
              href={`/workforce/decisions?org=${o.churchId}`}
              className={`px-2.5 py-1 rounded-full border ${o.churchId === org.churchId ? "border-accent-blue-light text-accent-blue-light" : "border-border-subtle text-muted"}`}
            >
              {o.name}
            </Link>
          ))}
        </div>
      )}
      <DecisionPoolClient churchId={org.churchId} orgName={org.name} canCreate={canCreate} />
    </div>
  );
}
