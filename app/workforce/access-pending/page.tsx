import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { getMyWorkforceOrganizations } from "@/services/supabase/workforce";
import { ShieldQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

// Reached when a signed-in Plotabl user has no Workforce-entitled organization at all --
// distinct from "not signed in" (the public homepage handles that) and from "signed in, has
// access" (redirected straight into the Decision Pool). If access shows up later (an org enables
// the module, or a role gets assigned), the next visit to /workforce routes through normally --
// this page itself never grants anything.
export default async function WorkforceAccessPendingPage() {
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
  if (!user) redirect("/workforce");

  // If access was granted since the user last checked, don't strand them here.
  const organizations = await getMyWorkforceOrganizations(supabase);
  if (organizations.length > 0) redirect("/workforce");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 h-16 flex items-center border-b border-border-subtle">
        <WorkforceLogo />
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center mx-auto mb-5">
            <ShieldQuestion size={26} className="text-accent-gold" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Access pending</h1>
          <p className="text-muted text-sm">
            Your account isn&apos;t yet entitled to Plotabl Workforce for any organization. Ask your organization&apos;s owner to
            enable the Workforce module, or to assign you a Workforce role.
          </p>
        </div>
      </div>
    </div>
  );
}
