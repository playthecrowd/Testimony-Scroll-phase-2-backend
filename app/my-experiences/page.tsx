import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyRegistrationsWithDetails, MyRegistrationWithDetails } from "@/services/supabase/churchExperiences";
import { OccurrenceRegisterAction } from "@/components/experiences/OccurrenceRegisterAction";
import { formatOccurrenceTimeRange, isFutureOccurrence } from "@/lib/experienceTimezone";

export const dynamic = "force-dynamic";

// Member's own Experience registrations (Phase 10.3, checkpoint 5) -- upcoming vs. past, split by
// whether the occurrence's start time has already passed. Cancel is only offered on upcoming,
// non-cancelled registrations (matches OccurrenceRegisterAction's own gating).
export default async function MyExperiencesPage() {
  let items: MyRegistrationWithDetails[] = [];
  let loadError = "";
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fmy-experiences");

    items = await getMyRegistrationsWithDetails(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[MyExperiencesPage] Failed to load registrations:", err);
    loadError = "We couldn't load your Experiences right now. Please try again shortly.";
  }

  const upcoming = items.filter((i) => isFutureOccurrence(i.occurrence.startsAt) && i.registration.status !== "cancelled");
  const past = items.filter((i) => !isFutureOccurrence(i.occurrence.startsAt) || i.registration.status === "cancelled");

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2 mb-1">
        <HeartHandshake size={24} className="text-accent-blue-light" /> My Experiences
      </h1>
      <p className="text-muted text-sm mb-6">Your Experience registrations, upcoming and past.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : items.length === 0 ? (
        <EmptyState message="You haven't registered for any Experiences yet." />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">No upcoming registrations.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(({ registration, occurrence, experience }) => (
                  <div key={registration.id} className="qk-card p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link href={`/experiences/${experience.id}`} className="text-sm font-medium text-foreground hover:text-accent-blue-light">
                        {experience.title}
                      </Link>
                      <p className="text-[11px] text-muted">{formatOccurrenceTimeRange(occurrence.startsAt, occurrence.endsAt, occurrence.timezone)}</p>
                    </div>
                    <OccurrenceRegisterAction occurrenceId={occurrence.id} occurrenceStatus={occurrence.status} initialRegistration={registration} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Past</h2>
            {past.length === 0 ? (
              <p className="text-sm text-muted">No past Experiences yet.</p>
            ) : (
              <div className="space-y-2">
                {past.map(({ registration, occurrence, experience }) => (
                  <div key={registration.id} className="qk-card p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-foreground">{experience.title}</p>
                      <p className="text-[11px] text-muted">{formatOccurrenceTimeRange(occurrence.startsAt, occurrence.endsAt, occurrence.timezone)}</p>
                    </div>
                    <span className="text-[11px] text-muted">
                      {registration.status === "cancelled" ? "Cancelled" : registration.completionStatus === "completed" ? "Completed" : registration.attendanceStatus === "attended" ? "Attended" : "Registered"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="mt-8">
        <LinkButton href="/experiences" variant="secondary" size="sm">
          Browse Experiences
        </LinkButton>
      </div>
    </div>
  );
}
