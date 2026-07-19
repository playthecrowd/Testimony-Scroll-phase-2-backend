import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { LessonsFeaturedList } from "@/components/admin/LessonsFeaturedList";
import { getPublishedLessons } from "@/services/supabase/lessons";

export const dynamic = "force-dynamic";

// Seventh real admin page (Phase 9, docs/PHASE9_AUDIT.md) -- "featured" is a platform-wide
// curation decision, so it lives here rather than on the host-scoped /experience-builder list.
export default async function AdminLessonsPage() {
  const supabase = await createClient();

  let gate;
  try {
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

  let lessons: Awaited<ReturnType<typeof getPublishedLessons>> = [];
  let loadError = "";
  try {
    lessons = await getPublishedLessons(supabase);
  } catch (err) {
    console.error("[AdminLessonsPage] Failed to load lessons:", err);
    loadError = "We couldn't load lessons right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Featured Lessons</h1>
        <Link href="/admin" className="text-xs text-accent-blue-light hover:underline">
          ← Admin Home
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Choose which published lessons are emphasized on the Lessons discovery page.</p>
      {loadError ? <ErrorState message={loadError} /> : <LessonsFeaturedList lessons={lessons} />}
    </div>
  );
}
