import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getPublishedChurches } from "@/services/supabase/churches";
import { getMyLessonRequests } from "@/services/supabase/lessonRequests";
import { RequestLessonForm } from "./RequestLessonForm";

export const dynamic = "force-dynamic";

export default async function RequestLessonPage() {
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
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to request a lesson.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let churches: Awaited<ReturnType<typeof getPublishedChurches>> = [];
  let myRequests: Awaited<ReturnType<typeof getMyLessonRequests>> = [];
  let loadError = "";
  try {
    [churches, myRequests] = await Promise.all([getPublishedChurches(supabase), getMyLessonRequests(supabase)]);
  } catch (err) {
    console.error("[RequestLessonPage] Failed to load churches/requests:", err);
    loadError = "We couldn't load this page right now. Please try again shortly.";
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Request a Lesson</h1>
        <LinkButton href="/lesson-requests" variant="secondary" size="sm">
          View Approved Requests
        </LinkButton>
      </div>
      <p className="text-muted text-sm mb-6">Ask a church, or the whole Quest for the Kingdom platform, to teach on a topic.</p>
      {loadError ? <ErrorState message={loadError} /> : <RequestLessonForm churches={churches} myRequests={myRequests} />}
    </div>
  );
}
