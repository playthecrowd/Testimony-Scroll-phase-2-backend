import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyWorkforceOrganizations, getWorkforceAccess, listDepartments } from "@/services/supabase/workforce";
import { NewDecisionForm } from "@/components/workforce/NewDecisionForm";

export const dynamic = "force-dynamic";

export default async function NewWorkforceDecisionPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const org = organizations.find((o) => o.churchId === orgParam) ?? organizations[0];
  if (!org) redirect("/workforce");

  const access = await getWorkforceAccess(supabase, org.churchId);
  const canCreate = access.isManager || access.roles.some((r) => r.role === "stakeholder");
  // Server-side guard mirrors wf_decisions' own RLS insert policy -- redirect here is purely UX
  // (a non-entitled request would be rejected by RLS regardless), same convention as every other
  // guarded page in this codebase.
  if (!canCreate) redirect(`/workforce/decisions?org=${org.churchId}`);

  const departments = await listDepartments(supabase, org.churchId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-foreground">New Decision</h1>
        <Link href={`/workforce/decisions?org=${org.churchId}`} className="text-xs text-accent-blue-light hover:underline">
          ← Back to Decision Pool
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">{org.name}</p>
      <NewDecisionForm churchId={org.churchId} departments={departments} />
    </div>
  );
}
