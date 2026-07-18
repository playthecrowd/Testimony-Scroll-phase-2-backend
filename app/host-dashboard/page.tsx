import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, BookOpen, Users2, Send, PencilLine, UserPlus, Sparkles, MessageSquareText, Feather } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyHostChurches, getChurchMemberCount } from "@/services/supabase/churches";
import { getManagedLessonsByChurch } from "@/services/supabase/lessons";
import { getChurchLessonRequests } from "@/services/supabase/lessonRequests";
import { getChurchTestimonies } from "@/services/supabase/testimonies";
import { StatPill, SectionCard } from "@/components/ui/StatPill";
import { LinkButton } from "@/components/ui/Button";
import { LessonThumbnail } from "@/components/lessons/LessonThumbnail";
import { formatDate, isWithin } from "@/lib/utils";
import { PublishedLesson } from "@/types";

export const dynamic = "force-dynamic";

const NEW_LESSON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Real, church-scoped Host Dashboard. Previously this page ran entirely on data/churches.ts
// (mock), which meant any host whose real church_memberships.church_id didn't match a mock
// seed id silently fell back to churches[0] -- the demo "Radiant Life Church" -- along with its
// stale member/lesson counts. That fallback is gone: church identity and lesson/member stats now
// come from the same real, RLS-scoped churches/church_memberships/lessons tables the Experience
// Builder already uses (see services/supabase/churches.ts, services/supabase/lessons.ts).
//
export default async function HostDashboardPage() {
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
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to view this dashboard.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();

  if (profile?.account_type !== "host") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">This dashboard is for Church Hosts.</p>
        <LinkButton href="/dashboard">Go to My Dashboard</LinkButton>
      </div>
    );
  }

  let churches;
  try {
    churches = await getMyHostChurches(supabase);
  } catch (err) {
    console.error("[HostDashboardPage] Failed to load managed churches:", err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your church right now. Please try again shortly." />
      </div>
    );
  }
  if (churches.length === 0) redirect("/onboarding/church");

  // A host can manage more than one church in the data model; this dashboard shows the first one
  // for now (matches the single-church-id assumption already used by resolvePostAuthDestination
  // and services/authService.ts). Managing/switching between multiple churches is out of scope
  // for this phase.
  const church = churches[0];

  let lessons: PublishedLesson[] = [];
  let memberCount = 0;
  let pendingRequestCount = 0;
  let pendingTestimonyCount = 0;
  let loadError = "";
  try {
    const [lessonsResult, memberCountResult, requestsResult, testimoniesResult] = await Promise.all([
      getManagedLessonsByChurch(supabase, church.id),
      getChurchMemberCount(supabase, church.id),
      getChurchLessonRequests(supabase, church.id),
      getChurchTestimonies(supabase, church.id),
    ]);
    lessons = lessonsResult;
    memberCount = memberCountResult;
    pendingRequestCount = requestsResult.filter((r) => r.status === "submitted" || r.status === "under_review").length;
    pendingTestimonyCount = testimoniesResult.filter((t) => t.churchStatus === "pending").length;
  } catch (err) {
    console.error("[HostDashboardPage] Failed to load church stats:", err);
    loadError = "We couldn't load your church's stats right now. Please try again shortly.";
  }

  const publishedCount = lessons.filter((l) => l.status === "published").length;
  const draftCount = lessons.filter((l) => l.status === "draft").length;
  const recentLessons = lessons.slice(0, 8);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {church.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={church.logoUrl} className="w-14 h-14 rounded-xl object-cover" alt="" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center shrink-0">
            <Building2 size={24} className="text-accent-blue-light" />
          </div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 size={22} className="text-accent-blue-light" /> {church.name} Host Dashboard
          </h1>
          <p className="text-muted text-sm">
            {[church.city, church.region].filter(Boolean).join(", ")}
            {church.city || church.region ? " · " : ""}
            {memberCount.toLocaleString()} member{memberCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/host-dashboard/church-profile" className="sm:ml-auto text-xs text-accent-blue-light hover:underline shrink-0">
          Edit Church Profile
        </Link>
      </div>

      {loadError && <ErrorState message={loadError} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatPill icon={BookOpen} value={lessons.length} label="Total Lessons" href="/experience-builder" />
        <StatPill icon={Send} value={publishedCount} label="Published" href="/experience-builder" />
        <StatPill icon={PencilLine} value={draftCount} label="Drafts" href="/experience-builder" />
        <StatPill icon={Users2} value={memberCount} label="Church Members" href="/host-dashboard/members" />
      </div>

      {lessons.length === 0 && !loadError && (
        <div className="qk-card p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <Sparkles size={28} className="text-accent-purple shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">You haven&apos;t built any lessons yet</p>
            <p className="text-xs text-muted mt-0.5">
              Create your first lesson experience to get {church.name} started on Quest for the Kingdom.
            </p>
          </div>
          <LinkButton href="/experience-builder" className="shrink-0">
            Start Building Your First Lesson
          </LinkButton>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Grow Your Church" icon={UserPlus}>
          <div className="space-y-2.5">
            <p className="text-xs text-muted">Invite the people at {church.name} to join Quest for the Kingdom.</p>
            <LinkButton href="/host-dashboard/members" variant="secondary" size="sm">
              <UserPlus size={13} /> Invite Members
            </LinkButton>
          </div>
        </SectionCard>

        <SectionCard title="Lesson Requests" action="View All" actionHref="/host-dashboard/lesson-requests" icon={MessageSquareText}>
          {pendingRequestCount > 0 ? (
            <p className="text-sm text-muted">
              <span className="text-foreground font-semibold">{pendingRequestCount}</span> request{pendingRequestCount === 1 ? "" : "s"}{" "}
              waiting on {church.name}.
            </p>
          ) : (
            <p className="text-sm text-muted">No lesson requests waiting right now.</p>
          )}
        </SectionCard>

        <SectionCard title="Testimony Review" action="View All" actionHref="/host-dashboard/testimonies" icon={Feather}>
          {pendingTestimonyCount > 0 ? (
            <p className="text-sm text-muted">
              <span className="text-foreground font-semibold">{pendingTestimonyCount}</span> testimon{pendingTestimonyCount === 1 ? "y" : "ies"}{" "}
              awaiting review.
            </p>
          ) : (
            <p className="text-sm text-muted">No testimonies awaiting review right now.</p>
          )}
        </SectionCard>

        <SectionCard title="Recent Lessons" action="Build a Lesson Experience" actionHref="/experience-builder" icon={BookOpen}>
          {recentLessons.length === 0 && !loadError ? (
            <p className="text-sm text-muted">No lessons yet -- build your first one to see it here.</p>
          ) : (
            <div className="space-y-2.5">
              {recentLessons.map((l) => (
                <Link key={l.id} href={`/lessons/${l.slug}`} className="flex items-center gap-2.5 group">
                  <LessonThumbnail src={l.featuredImageUrl} alt="" aspect="square" rounded="rounded-lg" className="w-10 h-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-accent-blue-light">{l.title}</p>
                    <p className="text-[11px] text-muted">{l.date ? formatDate(l.date) : "No date set"}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      l.status === "draft" ? "bg-accent-gold/15 text-accent-gold" : "bg-accent-blue/15 text-accent-blue-light"
                    }`}
                  >
                    {l.status === "draft" ? "Draft" : "Published"}
                  </span>
                  {isWithin(l.createdAt, NEW_LESSON_WINDOW_MS) && (
                    <span className="text-[10px] bg-accent-purple/15 text-accent-purple px-2 py-0.5 rounded-full shrink-0">New</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
