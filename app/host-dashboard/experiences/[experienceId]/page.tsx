import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import {
  getExperienceById,
  getExperienceLessons,
  getOccurrencesForExperience,
  getParticipationCountsForOccurrences,
} from "@/services/supabase/churchExperiences";
import { getManagedLessonsByChurch } from "@/services/supabase/lessons";
import { getChurchMinistries } from "@/services/supabase/churches";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { ChurchExperience, ChurchExperienceLessonLink, ChurchExperienceOccurrence, ChurchMinistry, PublishedLesson } from "@/types";
import { ExperienceStatusBadge, ExperienceVisibilityBadge, OccurrenceStatusBadge, EXPERIENCE_TYPE_LABELS, EXPERIENCE_FORMAT_LABELS } from "@/components/experiences/ExperienceStatusBadge";
import { ExperienceStatusActions } from "@/components/experiences/ExperienceStatusActions";
import { ExperienceLessonsEditor } from "@/components/experiences/ExperienceLessonsEditor";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Host Experience detail page (Phase 10.3, checkpoint 2). Overview + lessons + occurrences all on
// one page via sections, not separate tabs-as-pages, per the "avoid unnecessary pages" instruction
// -- occurrence-specific detail (registrations/attendance/walk-ins) has its own page, since an
// occurrence carries substantially more content than fits reasonably in a list row here.
export default async function ExperienceDetailPage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;

  let userId: string | null = null;
  let experience: ChurchExperience | null = null;
  let ministries: ChurchMinistry[] = [];
  let churchLessons: PublishedLesson[] = [];
  let experienceLessons: ChurchExperienceLessonLink[] = [];
  let occurrences: ChurchExperienceOccurrence[] = [];
  let participation: Awaited<ReturnType<typeof getParticipationCountsForOccurrences>> = new Map();
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
      experience = await getExperienceById(supabase, experienceId);

      if (experience) {
        const { data: membership } = await supabase
          .from("church_memberships")
          .select("role")
          .eq("profile_id", userId)
          .eq("church_id", experience.churchId)
          .maybeSingle();
        role = membership?.role;

        if (hasChurchEditAccess(role)) {
          [ministries, churchLessons, experienceLessons, occurrences] = await Promise.all([
            getChurchMinistries(supabase, experience.churchId),
            getManagedLessonsByChurch(supabase, experience.churchId),
            getExperienceLessons(supabase, experienceId),
            getOccurrencesForExperience(supabase, experienceId),
          ]);
          participation = await getParticipationCountsForOccurrences(supabase, occurrences.map((o) => o.id));
        }
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[ExperienceDetailPage] Failed to load Experience "${experienceId}":`, err);
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
  if (!userId) redirect("/login");
  if (!experience) notFound();

  if (!hasChurchEditAccess(role)) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have permission to manage this Experience.</p>
        <LinkButton href="/host-dashboard/experiences">Go to Experiences</LinkButton>
      </div>
    );
  }

  const lessonById = new Map(churchLessons.map((l) => [l.id, l]));
  const totals = occurrences.reduce(
    (acc, o) => {
      const c = participation.get(o.id);
      if (!c) return acc;
      return {
        confirmed: acc.confirmed + c.confirmed,
        waitlisted: acc.waitlisted + c.waitlisted,
        attended: acc.attended + c.attended,
        completed: acc.completed + c.completed,
        cancelled: acc.cancelled + c.cancelled,
      };
    },
    { confirmed: 0, waitlisted: 0, attended: 0, completed: 0, cancelled: 0 }
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{experience.title}</h1>
        <Link href="/host-dashboard/experiences" className="text-xs text-accent-blue-light hover:underline">
          ← Back to Experiences
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <ExperienceStatusBadge status={experience.status} />
        <ExperienceVisibilityBadge visibility={experience.visibility} />
        <span className="text-xs text-muted">{EXPERIENCE_TYPE_LABELS[experience.type] ?? experience.type}</span>
        <span className="text-xs text-muted">· {EXPERIENCE_FORMAT_LABELS[experience.format] ?? experience.format}</span>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <section className="qk-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Overview</h2>
            {experience.summary && <p className="text-sm text-foreground mb-2">{experience.summary}</p>}
            {experience.fullDescription && <p className="text-sm text-muted mb-3 whitespace-pre-wrap">{experience.fullDescription}</p>}
            <dl className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted">Completion Method</dt>
                <dd className="text-foreground">{experience.completionMethod === "host_marked" ? "Host Marks Completion" : "Member Self-Attests"}</dd>
              </div>
              <div>
                <dt className="text-muted">Registration</dt>
                <dd className="text-foreground">
                  {experience.registrationRequired ? "Required" : "Not required"}
                  {experience.approvalRequired ? " · Host approval required" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Default Capacity</dt>
                <dd className="text-foreground">{experience.defaultCapacity ?? "Unlimited"}</dd>
              </div>
              <div>
                <dt className="text-muted">Ministry</dt>
                <dd className="text-foreground">{ministries.find((m) => m.id === experience.ministryId)?.name ?? "None"}</dd>
              </div>
              <div>
                <dt className="text-muted">Last Updated</dt>
                <dd className="text-foreground">{formatDate(experience.updatedAt)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <LinkButton href={`/host-dashboard/experiences/${experience.id}/edit`} size="sm" variant="secondary">
                Edit Details
              </LinkButton>
            </div>
          </section>

          <section className="qk-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Occurrences</h2>
              <LinkButton href={`/host-dashboard/experiences/${experience.id}/occurrences/new`} size="sm">
                <Plus size={14} /> Schedule Occurrence
              </LinkButton>
            </div>
            {occurrences.length === 0 ? (
              <p className="text-sm text-muted">No occurrences scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {occurrences.map((o) => {
                  const c = participation.get(o.id);
                  return (
                    <Link
                      key={o.id}
                      href={`/host-dashboard/experiences/${experience.id}/occurrences/${o.id}`}
                      className="qk-card p-3 flex flex-wrap items-center justify-between gap-2 hover:border-accent-blue-light transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatDate(o.startsAt)}</p>
                        <p className="text-[11px] text-muted">{o.timezone}{o.locationName ? ` · ${o.locationName}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted">
                          {c?.confirmed ?? 0}/{o.capacity ?? "∞"} confirmed{(c?.waitlisted ?? 0) > 0 ? ` · ${c!.waitlisted} waitlisted` : ""}
                        </span>
                        <OccurrenceStatusBadge status={o.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="qk-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Attached Lessons</h2>
            <ExperienceLessonsEditor experienceId={experience.id} churchLessons={churchLessons} initialLinks={experienceLessons} />
            {experienceLessons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {experienceLessons.map((link) => (
                  <span key={link.id} className="text-[11px] bg-surface-2 border border-border-subtle text-muted px-2 py-1 rounded-full">
                    {lessonById.get(link.lessonId)?.title ?? "Untitled lesson"} · {link.relationship === "required" ? "Required" : "Recommended"}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="qk-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Manage</h2>
            <ExperienceStatusActions experienceId={experience.id} status={experience.status} />
          </section>

          <section className="qk-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Participation Summary</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Confirmed</dt><dd className="text-foreground">{totals.confirmed}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Waitlisted</dt><dd className="text-foreground">{totals.waitlisted}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Attended</dt><dd className="text-foreground">{totals.attended}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Completed</dt><dd className="text-foreground">{totals.completed}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Cancelled</dt><dd className="text-foreground">{totals.cancelled}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
