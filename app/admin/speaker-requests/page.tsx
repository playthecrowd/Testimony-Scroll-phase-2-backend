import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { SpeakerRequestsList } from "@/components/admin/SpeakerRequestsList";
import { getSpeakerRequestsForAdmin } from "@/services/supabase/speakerRequests";

export const dynamic = "force-dynamic";

export default async function AdminSpeakerRequestsPage() {
  // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
  // inside this try so that failure renders the graceful branded error state below.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let gate;
  try {
    supabase = await createClient();
    gate = await getPlatformAdminGate(supabase);
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

  if (!gate.userId) redirect("/login");
  if (!gate.isPlatformAdmin) return <NotAuthorized />;

  let requests: Awaited<ReturnType<typeof getSpeakerRequestsForAdmin>> = [];
  let loadError = "";
  try {
    requests = await getSpeakerRequestsForAdmin(supabase);
  } catch (err) {
    console.error("[AdminSpeakerRequestsPage] Failed to load speaker requests:", err);
    loadError = "We couldn't load speaker requests right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Speaker Requests</h1>
        <Link href="/admin" className="text-xs text-accent-blue-light hover:underline">
          ← Admin Home
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Reviews for people who submitted a &ldquo;Become a Speaker&rdquo; request.</p>
      {loadError ? <ErrorState message={loadError} /> : <SpeakerRequestsList requests={requests} />}
    </div>
  );
}
