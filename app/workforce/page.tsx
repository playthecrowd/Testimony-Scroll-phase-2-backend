import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { getMyWorkforceOrganizations } from "@/services/supabase/workforce";

export const dynamic = "force-dynamic";

// Module shell -- proves the flag/entitlement/RLS plumbing end to end: build-wide flag off -> 404
// (the route genuinely doesn't exist yet for this deployment, same as any other unreleased route
// in this codebase); signed out -> /login; signed in but no org entitles them -> a plain
// "not yet available" state; entitled -> a list of orgs, each linking into the Decision Pool
// (Phase 2). The rest of the module chrome (nav menu per the UI content guide, org switcher UI)
// still ships in a later phase.
export default async function WorkforcePage() {
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

  const organizations = await getMyWorkforceOrganizations(supabase);

  if (organizations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <EmptyState message="Plotabl Workforce isn't available on your account yet." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 space-y-4">
      <h1 className="text-2xl font-semibold">Plotabl Workforce</h1>
      <p className="text-muted text-sm">Move every decision from intent to understanding, action, and measurable outcomes.</p>
      <ul className="qk-card divide-y divide-white/10">
        {organizations.map((org) => (
          <li key={org.churchId} className="p-4 flex items-center justify-between">
            <Link href={`/workforce/decisions?org=${org.churchId}`} className="hover:underline">
              {org.name}
            </Link>
            <span className="text-xs text-muted">{org.isManager ? "Manager" : "Member"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
