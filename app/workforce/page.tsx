import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { WorkforcePublicHomepage } from "@/components/workforce/WorkforcePublicHomepage";
import { WorkforceAppShell } from "@/components/workforce/WorkforceAppShell";
import { getMyWorkforceOrganizations, getWorkforceAccess, getMyProfileName, getRoleBadgeLabel } from "@/services/supabase/workforce";
import Link from "next/link";

export const dynamic = "force-dynamic";

// /workforce is three different screens depending on who's asking, matching the required
// architecture: signed out -> the public Workforce homepage (never Q4K, never an auto-redirect
// into a login screen); signed in with access to exactly one org -> straight into that org's
// Decision Pool (no pointless picker step); signed in with access to more than one -> an org
// picker inside the real authenticated shell; signed in with no access anywhere ->
// /workforce/access-pending.
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
  if (!user) return <WorkforcePublicHomepage />;

  const organizations = await getMyWorkforceOrganizations(supabase);
  if (organizations.length === 0) redirect("/workforce/access-pending");
  if (organizations.length === 1) redirect(`/workforce/decisions?org=${organizations[0].churchId}`);

  const primary = organizations[0];
  const [access, userName] = await Promise.all([getWorkforceAccess(supabase, primary.churchId), getMyProfileName(supabase)]);

  return (
    <WorkforceAppShell
      churchId={primary.churchId}
      orgName={primary.name}
      userName={userName ?? "You"}
      roleLabel={getRoleBadgeLabel(access)}
      isManager={access.isManager}
    >
      <div className="max-w-2xl mx-auto py-16 px-4 space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Choose an organization</h1>
        <ul className="qk-card rounded-2xl divide-y divide-border-subtle">
          {organizations.map((org) => (
            <li key={org.churchId} className="p-4 flex items-center justify-between">
              <Link href={`/workforce/decisions?org=${org.churchId}`} className="hover:text-accent-blue text-foreground font-medium">
                {org.name}
              </Link>
              <span className="text-xs text-muted">{org.isManager ? "Manager" : "Member"}</span>
            </li>
          ))}
        </ul>
      </div>
    </WorkforceAppShell>
  );
}
