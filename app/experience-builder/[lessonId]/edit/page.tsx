import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getLessonBySlug } from "@/services/supabase/lessons";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { PublishedLesson } from "@/types";
import { EditExperienceForm } from "./EditExperienceForm";

export const dynamic = "force-dynamic";

// The [lessonId] segment holds the lesson's slug, matching the existing /lessons/[lessonId]
// convention elsewhere in this app (the folder name predates slugs being the actual lookup key).
export default async function EditExperiencePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId: lessonSlug } = await params;

  // redirect()/notFound() throw internally for Next's router to catch -- they must never be
  // called from inside a try/catch that doesn't explicitly re-throw them, or this handler would
  // swallow that signal into the generic error state below instead of actually redirecting.
  // So every Supabase call happens in the try below, and every control-flow decision happens
  // after it, outside the try entirely.
  let userId: string | null = null;
  let lesson: PublishedLesson | null = null;
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
      // RLS-gated: published rows are visible to anyone, a draft only to its own church's
      // host/admin -- a nonexistent OR unauthorized-draft lookup both come back null here.
      lesson = await getLessonBySlug(supabase, lessonSlug);

      if (lesson?.church) {
        // RLS alone is not sufficient to gate this *edit* page: a published lesson is
        // legitimately visible to anyone via the query above, but only a host/admin of its own
        // church may edit it. Same membership check submitLessonDraft already performs.
        const { data: membership } = await supabase
          .from("church_memberships")
          .select("role")
          .eq("profile_id", userId)
          .eq("church_id", lesson.church.id)
          .maybeSingle();
        role = membership?.role;
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[EditExperiencePage] Failed to load lesson "${lessonSlug}":`, err);
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
        <ErrorState message="We couldn't load this lesson for editing right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect("/login");
  if (!lesson) notFound();
  // A campaign lesson has no owning church and is never editable through this host-only route --
  // it's managed exclusively via /admin/campaign-lessons.
  if (!lesson.church) notFound();

  if (!hasChurchEditAccess(role)) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have permission to edit this lesson.</p>
        <p className="text-muted text-sm mb-6">Only a Host or Admin of {lesson.church.name} can edit this lesson experience.</p>
        <LinkButton href="/experience-builder">Go to Experience Builder</LinkButton>
      </div>
    );
  }

  return <EditExperienceForm lesson={lesson} />;
}
