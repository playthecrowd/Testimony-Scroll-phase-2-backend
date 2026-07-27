import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Globe2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import {
  getExperienceById,
  getUpcomingOccurrencesForMember,
  getMyRegistrationsForOccurrences,
} from "@/services/supabase/churchExperiences";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { ChurchExperience, ChurchExperienceOccurrence, ChurchExperienceRegistration } from "@/types";
import { EXPERIENCE_TYPE_LABELS, EXPERIENCE_FORMAT_LABELS } from "@/components/experiences/ExperienceStatusBadge";
import { OccurrenceRegisterAction } from "@/components/experiences/OccurrenceRegisterAction";
import { formatOccurrenceTimeRange } from "@/lib/experienceTimezone";

export const dynamic = "force-dynamic";

// Member Experience detail (Phase 10.3, checkpoint 5). RLS (church_experiences_select_published_or_managed)
// already restricts a member to Experiences at a church they belong to that are actually
// published -- a draft, an archived Experience, or one from an unauthorized church all resolve to
// "not found" here, never a partial leak of draft content.
export default async function MemberExperienceDetailPage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;

  let experience: ChurchExperience | null = null;
  let occurrences: ChurchExperienceOccurrence[] = [];
  let myRegistrations = new Map<string, ChurchExperienceRegistration | null>();
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  // createClient() and the data-loading below each get their own try/catch so a thrown redirect()
  // signal (Next.js's internal control-flow throw) never lands inside a catch that would swallow
  // it and misreport a signed-out visit as a generic load failure.
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[MemberExperienceDetailPage] Failed to initialize Supabase client:`, err);
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
  if (loadFailed || !supabase) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this Experience right now. Please try again shortly." />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=%2Fexperiences%2F${experienceId}`);

  try {
    experience = await getExperienceById(supabase, experienceId);
    if (experience && experience.status === "published") {
      occurrences = await getUpcomingOccurrencesForMember(supabase, experienceId);
      myRegistrations = await getMyRegistrationsForOccurrences(supabase, occurrences.map((o) => o.id));
    } else if (experience && experience.status !== "published") {
      // A host previewing their own draft is handled by the host detail page, not this one --
      // members never see draft/archived content here regardless of RLS visibility to a manager.
      experience = null;
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[MemberExperienceDetailPage] Failed to load Experience "${experienceId}":`, err);
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
        <ErrorState message="We couldn't load this Experience right now. Please try again shortly." />
      </div>
    );
  }
  if (!experience) notFound();

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/experiences" className="text-xs text-accent-blue-light hover:underline mb-3 inline-block">
        ← Back to Experiences
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-accent-blue-light font-medium uppercase tracking-wide">
          {EXPERIENCE_TYPE_LABELS[experience.type] ?? experience.type}
        </span>
        <span className="text-[11px] text-muted flex items-center gap-1">
          {experience.format === "online" ? <Globe2 size={11} /> : <MapPin size={11} />}
          {EXPERIENCE_FORMAT_LABELS[experience.format] ?? experience.format}
        </span>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{experience.title}</h1>
      {experience.summary && <p className="text-sm text-foreground mb-2">{experience.summary}</p>}
      {experience.fullDescription && <p className="text-sm text-muted mb-6 whitespace-pre-wrap">{experience.fullDescription}</p>}

      {(experience.preparationInstructions || experience.whatToBring || experience.ageGuidance || experience.accessibilityNotes) && (
        <div className="qk-card p-4 mb-6 space-y-2 text-xs">
          {experience.ageGuidance && <p><span className="text-muted">Age Guidance:</span> <span className="text-foreground">{experience.ageGuidance}</span></p>}
          {experience.accessibilityNotes && <p><span className="text-muted">Accessibility:</span> <span className="text-foreground">{experience.accessibilityNotes}</span></p>}
          {experience.preparationInstructions && <p><span className="text-muted">Preparation:</span> <span className="text-foreground">{experience.preparationInstructions}</span></p>}
          {experience.whatToBring && <p><span className="text-muted">What to Bring:</span> <span className="text-foreground">{experience.whatToBring}</span></p>}
        </div>
      )}

      <h2 className="text-sm font-semibold text-foreground mb-3">Upcoming Occurrences</h2>
      {occurrences.length === 0 ? (
        <EmptyState message="No upcoming occurrences scheduled yet. Check back soon." />
      ) : (
        <div className="space-y-3">
          {occurrences.map((o) => {
            const capacity = o.capacity ?? experience!.defaultCapacity;
            return (
              <div key={o.id} className="qk-card p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{formatOccurrenceTimeRange(o.startsAt, o.endsAt, o.timezone)}</p>
                  <p className="text-[11px] text-muted">
                    {o.locationName ?? experience!.locationName ?? ""}
                    {o.onlineUrl || experience!.onlineUrl ? " · Online link provided after registration" : ""}
                    {capacity != null ? ` · Capacity ${capacity}` : ""}
                  </p>
                </div>
                <OccurrenceRegisterAction occurrenceId={o.id} occurrenceStatus={o.status} initialRegistration={myRegistrations.get(o.id) ?? null} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
