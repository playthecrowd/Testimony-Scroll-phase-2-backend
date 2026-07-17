import { redirect } from "next/navigation";
import { Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const dynamic = "force-dynamic";

// Scaffolded destination for the Host Dashboard's "Invite Members" CTA -- full member
// management (invite by email, CSV import, share link, QR code) is Phase 2. This exists so the
// CTA has a real, safe route instead of a dead link or a 404.
export default async function HostMembersPage() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { count } = await supabase
      .from("church_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"]);

    if (!count) redirect("/onboarding/church");
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

  return (
    <ComingSoon
      icon={Users2}
      title="Church member management is coming soon"
      description="Inviting members by email, bulk CSV import, and a share link or QR code for members to join your church are on the way."
      backHref="/host-dashboard"
      backLabel="Back to Host Dashboard"
    />
  );
}
