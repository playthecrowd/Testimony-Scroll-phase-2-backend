import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getPublishedChurch } from "@/services/supabase/churches";
import { JoinActionButton } from "@/components/join/JoinActionButton";
import { joinChurchAction } from "../actions";

export const dynamic = "force-dynamic";

// Generic church join link/QR target (Part 6/7 "unique church invitation link"/"QR code") --
// reuses churches.slug directly rather than a separate table, and the existing
// church_memberships_insert_self_member_only RLS policy for the actual join write.
export default async function JoinChurchPage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const supabase = await createClient();

  let userId: string | null = null;
  let church;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    church = await getPublishedChurch(supabase, churchSlug);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[JoinChurchPage] Failed to load church "${churchSlug}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this join link right now. Please try again shortly." />
      </div>
    );
  }

  if (!church) notFound();

  if (!userId) {
    const next = `/join/${church.slug}`;
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <h1 className="text-xl font-bold text-foreground mb-2">Join {church.name}</h1>
        <p className="text-muted text-sm mb-6">Sign in or create a Kingdom Member account to join this church community.</p>
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
      {church.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={church.logoUrl} alt="" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
      )}
      <h1 className="text-xl font-bold text-foreground mb-2">Join {church.name}</h1>
      <p className="text-muted text-sm mb-6">
        {[church.city, church.region].filter(Boolean).join(", ")}
      </p>
      <JoinActionButton
        label={`Join ${church.name}`}
        action={() => joinChurchAction(church.id)}
        onSuccessHref={(result) => (result.error ? null : `/churches/${church.slug}`)}
      />
    </div>
  );
}
