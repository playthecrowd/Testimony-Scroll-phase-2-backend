import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { JoinActionButton } from "@/components/join/JoinActionButton";
import { acceptInviteAction } from "../../actions";

export const dynamic = "force-dynamic";

// Individually-invited path -- the token itself gates redemption (see accept_church_invite,
// supabase/migrations/0011_church_invites.sql); it deliberately does not require the redeeming
// account's email to match the invited address.
export default async function JoinByInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
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

  if (!userId) {
    const next = `/join/invite/${token}`;
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <h1 className="text-xl font-bold text-foreground mb-2">You&apos;ve been invited to Quest for the Kingdom</h1>
        <p className="text-muted text-sm mb-6">Sign in or create a Kingdom Member account to accept this invite.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <LinkButton href={`/login?next=${encodeURIComponent(next)}`}>Sign In</LinkButton>
          <LinkButton href={`/signup?next=${encodeURIComponent(next)}`} variant="secondary">
            Create Account
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-24 text-center px-4">
      <h1 className="text-xl font-bold text-foreground mb-2">You&apos;ve been invited</h1>
      <p className="text-muted text-sm mb-6">Accept this invite to join your church community.</p>
      <JoinActionButton
        label="Accept Invite"
        action={() => acceptInviteAction(token)}
        onSuccessHref={(result) => (result.error || !result.churchSlug ? null : `/churches/${result.churchSlug}`)}
      />
    </div>
  );
}
