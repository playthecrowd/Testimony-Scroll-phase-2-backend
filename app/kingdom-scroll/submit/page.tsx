import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getUserJourneysWithLessons } from "@/services/supabase/journeys";
import { SubmitTestimonyForm, EligibleLesson } from "./SubmitTestimonyForm";

export const dynamic = "force-dynamic";

export default async function SubmitTestimonyPage() {
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
        <p className="text-foreground font-semibold mb-2">Sign in to submit a testimony.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let eligibleLessons: EligibleLesson[] = [];
  let loadError = "";
  try {
    const journeysWithLessons = await getUserJourneysWithLessons(supabase);
    eligibleLessons = journeysWithLessons
      .filter((jl) => !!jl.journey.studiedCompletedAt)
      .map((jl) => ({ id: jl.lesson.id, title: jl.lesson.title }));
  } catch (err) {
    console.error("[SubmitTestimonyPage] Failed to load eligible lessons:", err);
    loadError = "We couldn't load your completed lessons right now. Please try again shortly.";
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Submit a Testimony</h1>
      <p className="text-muted text-sm mb-6">Share how a lesson you completed connected to your life.</p>
      {loadError ? <ErrorState message={loadError} /> : <SubmitTestimonyForm eligibleLessons={eligibleLessons} />}
    </div>
  );
}
