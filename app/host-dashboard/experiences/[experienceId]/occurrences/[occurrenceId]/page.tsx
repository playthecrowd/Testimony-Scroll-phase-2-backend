import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import {
  getExperienceById,
  getOccurrenceById,
  getRegistrationsForOccurrence,
  ChurchExperienceRegistrationWithProfile,
} from "@/services/supabase/churchExperiences";
import { getChurchMembers } from "@/services/supabase/churches";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { ChurchExperience, ChurchExperienceOccurrence, ChurchMember } from "@/types";
import { OccurrenceStatusBadge } from "@/components/experiences/ExperienceStatusBadge";
import { RegistrationsList } from "@/components/experiences/RegistrationsList";
import { WalkInForm } from "@/components/experiences/WalkInForm";
import { OccurrenceCancelAction } from "@/components/experiences/OccurrenceCancelAction";
import { formatOccurrenceTimeRange } from "@/lib/experienceTimezone";

export const dynamic = "force-dynamic";

// Host occurrence detail page (Phase 10.3, checkpoints 3/6/7/8): schedule info, registrant list
// (approve/reject/attendance/completion), walk-in recording, and cancel/finalize actions all live
// here -- one page, since an occurrence's registration/attendance data is substantially more than
// fits in the parent Experience detail page's occurrence list row.
export default async function OccurrenceDetailPage({ params }: { params: Promise<{ experienceId: string; occurrenceId: string }> }) {
  const { experienceId, occurrenceId } = await params;

  let userId: string | null = null;
  let experience: ChurchExperience | null = null;
  let occurrence: ChurchExperienceOccurrence | null = null;
  let registrations: ChurchExperienceRegistrationWithProfile[] = [];
  let eligibleMembers: ChurchMember[] = [];
  let role: string | null | undefined;
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      occurrence = await getOccurrenceById(supabase, occurrenceId);
      if (occurrence && occurrence.experienceId === experienceId) {
        const { data: membership } = await supabase
          .from("church_memberships")
          .select("role")
          .eq("profile_id", userId)
          .eq("church_id", occurrence.churchId)
          .maybeSingle();
        role = membership?.role;

        if (hasChurchEditAccess(role)) {
          [experience, registrations] = await Promise.all([
            getExperienceById(supabase, experienceId),
            getRegistrationsForOccurrence(supabase, occurrenceId),
          ]);
          const allMembers = await getChurchMembers(supabase, occurrence.churchId);
          const registeredProfileIds = new Set(registrations.map((r) => r.registration.profileId));
          eligibleMembers = allMembers.filter((m) => !registeredProfileIds.has(m.profileId));
        }
      } else {
        occurrence = null;
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[OccurrenceDetailPage] Failed to load occurrence "${occurrenceId}":`, err);
      loadFailed = true;
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }
  if (loadFailed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this occurrence right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect("/login");
  if (!occurrence || !experience) notFound();

  if (!hasChurchEditAccess(role)) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have permission to manage this occurrence.</p>
        <LinkButton href="/host-dashboard/experiences">Go to Experiences</LinkButton>
      </div>
    );
  }

  const confirmedCount = registrations.filter((r) => r.registration.status === "confirmed").length;
  const capacity = occurrence.capacity ?? experience.defaultCapacity;
  const atCapacity = capacity != null && confirmedCount >= capacity;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{experience.title}</h1>
        <Link href={`/host-dashboard/experiences/${experienceId}`} className="text-xs text-accent-blue-light hover:underline">
          ← Back to Experience
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <OccurrenceStatusBadge status={occurrence.status} />
        <span className="text-sm text-muted">{formatOccurrenceTimeRange(occurrence.startsAt, occurrence.endsAt, occurrence.timezone)}</span>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <section className="qk-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Registrations</h2>
              <span className="text-xs text-muted">
                {confirmedCount}/{capacity ?? "∞"} confirmed
              </span>
            </div>
            <RegistrationsList occurrenceId={occurrenceId} registrations={registrations} occurrenceCancelled={occurrence.status === "cancelled"} />
          </section>

          {occurrence.status === "scheduled" && (
            <section className="qk-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Record a Walk-In</h2>
              <WalkInForm occurrenceId={occurrenceId} eligibleMembers={eligibleMembers} atCapacity={atCapacity} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="qk-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Occurrence Details</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Timezone</dt><dd className="text-foreground">{occurrence.timezone}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Capacity</dt><dd className="text-foreground">{capacity ?? "Unlimited"}</dd></div>
              {occurrence.locationName && <div className="flex justify-between"><dt className="text-muted">Location</dt><dd className="text-foreground">{occurrence.locationName}</dd></div>}
              {occurrence.onlineUrl && <div className="flex justify-between"><dt className="text-muted">Meeting Link</dt><dd className="text-accent-blue-light truncate max-w-[140px]">{occurrence.onlineUrl}</dd></div>}
              {occurrence.cancellationReason && <div><dt className="text-muted">Cancellation Reason</dt><dd className="text-foreground">{occurrence.cancellationReason}</dd></div>}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href={`/host-dashboard/experiences/${experienceId}/occurrences/${occurrenceId}/edit`} size="sm" variant="secondary">
                Edit
              </LinkButton>
            </div>
          </section>

          <section className="qk-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Manage</h2>
            <OccurrenceCancelAction occurrenceId={occurrenceId} status={occurrence.status} />
          </section>
        </aside>
      </div>
    </div>
  );
}
