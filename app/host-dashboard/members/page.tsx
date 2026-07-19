import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyHostChurches, getChurchMembers, getChurchInvites } from "@/services/supabase/churches";
import { ChurchMembersManager } from "@/components/host-dashboard/ChurchMembersManager";
import { ChurchMember, ChurchInvite } from "@/types";

export const dynamic = "force-dynamic";

// Real church member management: invite by email, bulk CSV/paste import, a generic join
// link/QR code (churches.slug-based, no extra table), and the real member roster --
// see services/supabase/churches.ts and supabase/migrations/0011-0012 for the RLS this depends on.
export default async function HostMembersPage() {
  const supabase = await createClient();

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
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

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to manage members.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let churches;
  try {
    churches = await getMyHostChurches(supabase);
  } catch (err) {
    console.error("[HostMembersPage] Failed to load managed churches:", err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your church right now. Please try again shortly." />
      </div>
    );
  }
  if (churches.length === 0) redirect("/onboarding/church");
  const church = churches[0];

  let members: ChurchMember[] = [];
  let invites: ChurchInvite[] = [];
  let loadError = "";
  try {
    [members, invites] = await Promise.all([getChurchMembers(supabase, church.id), getChurchInvites(supabase, church.id)]);
  } catch (err) {
    console.error("[HostMembersPage] Failed to load members/invites:", err);
    loadError = "We couldn't load your church's members right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Church Members</h1>
      <p className="text-muted text-sm mb-6">Invite and manage the people at {church.name}.</p>
      {loadError ? <ErrorState message={loadError} /> : <ChurchMembersManager church={church} members={members} invites={invites} />}
    </div>
  );
}
