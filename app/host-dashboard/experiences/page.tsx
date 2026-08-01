import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarHeart, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState, EmptyState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyHostChurches } from "@/services/supabase/churches";
import { getManagedExperiences, getExperienceSummaries } from "@/services/supabase/churchExperiences";
import { isEntityManagerAccountType } from "@/lib/accountType";
import { AccountType } from "@/types";
import { ExperienceStatusBadge, ExperienceVisibilityBadge, EXPERIENCE_TYPE_LABELS, EXPERIENCE_FORMAT_LABELS } from "@/components/experiences/ExperienceStatusBadge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Host Experience list (Phase 10.3, checkpoint 2). Server-side auth guard, re-checked on every
// request, same shape as app/experience-builder/page.tsx: unauthenticated -> /login, host with no
// church yet -> /onboarding/church. Resolves the active church via the existing churches[0]
// convention at this page-entry-point layer only -- every service function it calls underneath
// takes an explicit churchId, never assumes it (owner decision 3 of 10, 2026-07-18; see
// docs/PHASE10_1_AUDIT.md's church-selection call-site table).
export default async function HostExperiencesPage() {
  // createClient() itself throws SupabaseConfigError when env vars are missing -- kept in its own
  // try, separate from the auth-guard try below, so that specific failure always renders the
  // branded error state rather than an uncaught 500.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
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

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    if (!profile || !isEntityManagerAccountType(profile.account_type as AccountType)) redirect("/dashboard");

    const { count } = await supabase
      .from("church_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"]);
    if (!count) redirect(profile.account_type === "organization" ? "/onboarding/organization" : "/onboarding/church");
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

  let churchId = "";
  let churchName = "";
  let experiences: Awaited<ReturnType<typeof getManagedExperiences>> = [];
  let summaries: Awaited<ReturnType<typeof getExperienceSummaries>> = new Map();
  let loadError = "";
  try {
    const churches = await getMyHostChurches(supabase);
    const church = churches[0];
    if (!church) redirect("/onboarding/church");
    churchId = church.id;
    churchName = church.name;
    experiences = await getManagedExperiences(supabase, churchId);
    summaries = await getExperienceSummaries(supabase, experiences.map((e) => e.id));
  } catch (err) {
    console.error("[HostExperiencesPage] Failed to load Experiences:", err);
    loadError = "We couldn't load your church's Experiences right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarHeart size={24} className="text-accent-blue-light" /> Experiences
        </h1>
        <LinkButton href="/host-dashboard/experiences/new" size="sm">
          <Plus size={15} /> New Experience
        </LinkButton>
      </div>
      <p className="text-muted text-sm mb-6">Manage {churchName ? `${churchName}'s` : "your church's"} discipleship Experiences.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : experiences.length === 0 ? (
        <EmptyState message="No Experiences yet. Create your first one to get started." />
      ) : (
        <div className="qk-card overflow-hidden">
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 text-[11px] font-medium text-muted uppercase tracking-wide border-b border-border-subtle">
            <span>Title</span>
            <span>Type</span>
            <span>Format</span>
            <span>Status</span>
            <span>Visibility</span>
            <span>Upcoming</span>
            <span>Lessons</span>
            <span>Updated</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {experiences.map((experience) => {
              const summary = summaries.get(experience.id);
              return (
                <Link
                  key={experience.id}
                  href={`/host-dashboard/experiences/${experience.id}`}
                  className="grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 items-center hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{experience.title}</p>
                    {experience.status === "archived" && <p className="text-[11px] text-muted">Archived</p>}
                  </div>
                  <span className="text-xs text-muted">{EXPERIENCE_TYPE_LABELS[experience.type] ?? experience.type}</span>
                  <span className="text-xs text-muted">{EXPERIENCE_FORMAT_LABELS[experience.format] ?? experience.format}</span>
                  <span><ExperienceStatusBadge status={experience.status} /></span>
                  <span><ExperienceVisibilityBadge visibility={experience.visibility} /></span>
                  <span className="text-xs text-muted">
                    {summary && summary.upcomingOccurrenceCount > 0
                      ? `${summary.upcomingOccurrenceCount} · next ${formatDate(summary.nextOccurrenceStartsAt!)}`
                      : "None scheduled"}
                  </span>
                  <span className="text-xs text-muted">{summary?.lessonCount ?? 0}</span>
                  <span className="text-xs text-muted">{formatDate(experience.updatedAt)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
