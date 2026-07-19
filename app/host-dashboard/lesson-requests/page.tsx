import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyHostChurches } from "@/services/supabase/churches";
import { getChurchLessonRequests } from "@/services/supabase/lessonRequests";
import { ChurchLessonRequestsList } from "@/components/host-dashboard/ChurchLessonRequestsList";
import { LessonRequest } from "@/types";

export const dynamic = "force-dynamic";

export default async function HostLessonRequestsPage() {
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
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to manage lesson requests.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let churches;
  try {
    churches = await getMyHostChurches(supabase);
  } catch (err) {
    console.error("[HostLessonRequestsPage] Failed to load managed churches:", err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your church right now. Please try again shortly." />
      </div>
    );
  }
  if (churches.length === 0) redirect("/onboarding/church");
  const church = churches[0];

  let requests: LessonRequest[] = [];
  let loadError = "";
  try {
    requests = await getChurchLessonRequests(supabase, church.id);
  } catch (err) {
    console.error("[HostLessonRequestsPage] Failed to load lesson requests:", err);
    loadError = "We couldn't load your church's lesson requests right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Lesson Requests</h1>
      <p className="text-muted text-sm mb-6">Requests members have directed to {church.name}.</p>
      {loadError ? <ErrorState message={loadError} /> : <ChurchLessonRequestsList churchId={church.id} requests={requests} />}
    </div>
  );
}
