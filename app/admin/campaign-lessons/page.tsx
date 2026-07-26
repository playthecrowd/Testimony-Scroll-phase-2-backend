import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { LinkButton } from "@/components/ui/Button";
import { CampaignLessonsList } from "@/components/admin/CampaignLessonsList";
import { getAllCampaignLessonsForAdmin } from "@/services/supabase/lessons";

export const dynamic = "force-dynamic";

// Ninth real admin page -- Year-Round Campaign Lessons (Phase Two). Deliberately its own section,
// distinct from /admin/lessons ("Featured Lessons," which only toggles `featured` on already
// church-authored, already-published lessons) -- this one owns full create/edit/publish/feature/
// highlight/sort for the admin-managed campaign-lesson category, plus CSV bulk import.
export default async function AdminCampaignLessonsPage() {
  // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
  // inside this try so that failure renders the graceful branded error state below.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let gate;
  try {
    supabase = await createClient();
    gate = await getPlatformAdminGate(supabase);
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

  if (!gate.userId) redirect("/login");
  if (!gate.isPlatformAdmin) return <NotAuthorized />;

  let lessons: Awaited<ReturnType<typeof getAllCampaignLessonsForAdmin>> = [];
  let loadError = "";
  try {
    lessons = await getAllCampaignLessonsForAdmin(supabase);
  } catch (err) {
    console.error("[AdminCampaignLessonsPage] Failed to load campaign lessons:", err);
    loadError = "We couldn't load campaign lessons right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Featured Campaign Lessons</h1>
        <div className="flex gap-3">
          <Link href="/admin" className="text-xs text-accent-blue-light hover:underline self-center">
            ← Admin Home
          </Link>
          <Link href="/admin/campaign-lessons/import" className="text-xs text-accent-blue-light hover:underline self-center">
            Bulk Upload (CSV)
          </Link>
          <LinkButton href="/admin/campaign-lessons/new" size="sm">
            New Campaign Lesson
          </LinkButton>
        </div>
      </div>
      <p className="text-muted text-sm mb-6">
        Year-Round Campaign Lessons (September–August, one per week). Create, edit, publish, feature, highlight, and sort them here --
        featured/highlighted published lessons also appear on the homepage and Lessons page.
      </p>

      {loadError ? <ErrorState message={loadError} /> : <CampaignLessonsList lessons={lessons} />}
    </div>
  );
}
