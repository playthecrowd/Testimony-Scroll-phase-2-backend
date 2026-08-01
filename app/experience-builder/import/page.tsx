import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyHostChurches } from "@/services/supabase/churches";
import { isEntityManagerAccountType } from "@/lib/accountType";
import { AccountType } from "@/types";
import { ImportRegularLessonsClient } from "./ImportRegularLessonsClient";

export const dynamic = "force-dynamic";

// Same server-side guard as /experience-builder itself (unauthenticated -> /login, non-host ->
// /dashboard, host with no church yet -> /onboarding/church) -- bulk upload is just another way to
// create lessons a Host could otherwise create one at a time, so it gets the identical gate.
export default async function ImportRegularLessonsPage() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !isEntityManagerAccountType(profile.account_type as AccountType)) redirect("/dashboard");

    const { count } = await supabase
      .from("church_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"]);

    if (!count) redirect(profile.account_type === "organization" ? "/onboarding/organization" : "/onboarding/church");
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    throw err;
  }

  const churches = await getMyHostChurches(supabase);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/experience-builder" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Your Lessons
      </Link>
      <h1 className="text-xl font-bold text-foreground mb-1">Bulk Upload Lessons</h1>
      <p className="text-muted text-sm mb-6">Import multiple lessons for your church at once from a CSV file.</p>
      <ImportRegularLessonsClient churches={churches} />
    </div>
  );
}
