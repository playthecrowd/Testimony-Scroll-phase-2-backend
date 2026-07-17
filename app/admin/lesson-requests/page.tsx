import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getPendingPublicLessonRequests } from "@/services/supabase/lessonRequests";
import { PublicLessonRequestsList } from "@/components/admin/PublicLessonRequestsList";

export const dynamic = "force-dynamic";

// First real Production Administrator surface (docs/PHASE5_AUDIT.md) -- profiles.is_platform_admin
// has existed since Milestone One with no UI anywhere until now. Server-checked here, same as
// every other role gate in this repo (church_memberships checks elsewhere) -- proxy.ts only
// handles the "signed in at all" edge redirect for /admin, never the real authorization decision.
export default async function AdminLessonRequestsPage() {
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

  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", userId).maybeSingle();
  if (!profile?.is_platform_admin) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have access to this page.</p>
        <p className="text-muted text-sm">This area is restricted to Quest for the Kingdom production administrators.</p>
      </div>
    );
  }

  let requests: Awaited<ReturnType<typeof getPendingPublicLessonRequests>> = [];
  let loadError = "";
  try {
    requests = await getPendingPublicLessonRequests(supabase);
  } catch (err) {
    console.error("[AdminLessonRequestsPage] Failed to load public lesson requests:", err);
    loadError = "We couldn't load public lesson requests right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Lesson Request Moderation</h1>
      <p className="text-muted text-sm mb-6">Public, platform-wide lesson requests awaiting review before anyone else can see them.</p>
      {loadError ? <ErrorState message={loadError} /> : <PublicLessonRequestsList requests={requests} />}
    </div>
  );
}
