import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getPublishedChurches } from "@/services/supabase/churches";
import { BecomeASpeakerForm } from "./BecomeASpeakerForm";

export const dynamic = "force-dynamic";

// Public, no sign-in required -- a prospective speaker may have no account at all. Reachable
// directly, or via a church-scoped link at /become-a-speaker/[churchSlug] (see that route).
export default async function BecomeASpeakerPage() {
  let churches: Awaited<ReturnType<typeof getPublishedChurches>> = [];
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    churches = await getPublishedChurches(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[BecomeASpeakerPage] Failed to load churches:", err);
    // Not fatal -- the form still works with the "not listed" option.
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Become a Speaker</h1>
      <p className="text-muted text-sm mb-6">Share your voice with the Kingdom. Tell us a bit about yourself and what you&apos;d like to teach.</p>
      <BecomeASpeakerForm churches={churches} />
    </div>
  );
}
