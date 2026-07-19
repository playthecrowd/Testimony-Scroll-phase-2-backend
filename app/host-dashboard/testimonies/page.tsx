import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyHostChurches } from "@/services/supabase/churches";
import { getChurchTestimonies } from "@/services/supabase/testimonies";
import { ChurchTestimonyReviewQueue } from "@/components/host-dashboard/ChurchTestimonyReviewQueue";
import { PublishedTestimony } from "@/types";

export const dynamic = "force-dynamic";

export default async function HostTestimoniesPage() {
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
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to review testimonies.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let churches;
  try {
    churches = await getMyHostChurches(supabase);
  } catch (err) {
    console.error("[HostTestimoniesPage] Failed to load managed churches:", err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your church right now. Please try again shortly." />
      </div>
    );
  }
  if (churches.length === 0) redirect("/onboarding/church");
  const church = churches[0];

  let testimonies: PublishedTestimony[] = [];
  let loadError = "";
  try {
    testimonies = await getChurchTestimonies(supabase, church.id);
  } catch (err) {
    console.error("[HostTestimoniesPage] Failed to load testimonies:", err);
    loadError = "We couldn't load your church's testimonies right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Testimony Review</h1>
      <p className="text-muted text-sm mb-6">Testimonies members have submitted to {church.name}.</p>
      {loadError ? <ErrorState message={loadError} /> : <ChurchTestimonyReviewQueue churchId={church.id} testimonies={testimonies} />}
    </div>
  );
}
