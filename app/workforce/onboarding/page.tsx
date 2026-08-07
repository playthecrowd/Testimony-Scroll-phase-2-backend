import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { getMyWorkforceOrganizations } from "@/services/supabase/workforce";
import { Building2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

// A freshly-created Workforce ("organization" account_type) profile has no organization entity
// yet -- that's created through Q4K's existing /onboarding/organization flow (church_id creation +
// host membership), reused here rather than duplicated, per "Workforce may reuse approved shared
// services underneath." Known, deliberate limitation of this pass: that reused flow still renders
// in Q4K's own chrome/theme, not Workforce's -- unifying that is a larger effort than this
// checkpoint, and is called out here rather than silently left inconsistent.
export default async function WorkforceOnboardingPage() {
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

  const organizations = await getMyWorkforceOrganizations(supabase);
  if (organizations.length > 0) redirect(`/workforce/decisions?org=${organizations[0].churchId}`);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 h-16 flex items-center border-b border-border-subtle">
        <WorkforceLogo />
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-accent-blue/15 border border-accent-blue/40 flex items-center justify-center mx-auto mb-5">
            <Building2 size={24} className="text-accent-blue" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Set up your organization</h1>
          <p className="text-muted text-sm mb-6">
            Plotabl Workforce is organization-based. Create your organization to unlock the Decision Pool and invite your team.
          </p>
          <Link
            href="/onboarding/organization"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors"
          >
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
