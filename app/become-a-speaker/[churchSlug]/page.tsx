import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getPublishedChurches, getPublishedChurch } from "@/services/supabase/churches";
import { BecomeASpeakerForm } from "../BecomeASpeakerForm";

export const dynamic = "force-dynamic";

// Church-scoped speaker request link (e.g. shared by a host from their Church Profile page) --
// same public, no-sign-in-required form as /become-a-speaker, just pre-selecting this church.
// Reuses the church-slug-in-the-URL shape /join/[churchSlug] already established, rather than a
// new token-based invite table -- a church slug is already a public, stable identifier.
export default async function BecomeASpeakerForChurchPage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;

  let church;
  let churches: Awaited<ReturnType<typeof getPublishedChurches>> = [];
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    [church, churches] = await Promise.all([getPublishedChurch(supabase, churchSlug), getPublishedChurches(supabase)]);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[BecomeASpeakerForChurchPage] Failed to load church "${churchSlug}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this page right now. Please try again shortly." />
      </div>
    );
  }
  if (!church) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Become a Speaker at {church.name}</h1>
      <p className="text-muted text-sm mb-6">Share your voice with the Kingdom. Tell us a bit about yourself and what you&apos;d like to teach.</p>
      <BecomeASpeakerForm churches={churches} defaultChurchId={church.id} />
    </div>
  );
}
