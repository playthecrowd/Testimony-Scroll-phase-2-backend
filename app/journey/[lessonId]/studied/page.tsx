import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getLessonById } from "@/services/supabase/lessons";
import { getOrCreateJourney, getJourneyItems } from "@/services/supabase/journeys";
import { ErrorState } from "@/components/ui/AsyncState";
import { PublishedLesson, LessonJourney, LessonJourneyItem } from "@/types";
import { StudiedClient } from "./StudiedClient";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The shared Studied route for every lesson, present or future -- [lessonId] holds lessons.id
// (a UUID), not a slug. This is the one place a journey record is ever created (via
// getOrCreateJourney's upsert), so the lesson detail page's Start/Continue button only ever needs
// to *read* journey state, never create it.
export default async function StudiedStagePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  // A handful of still-mocked widgets elsewhere (e.g. the member Dashboard's "Continue" card,
  // seeded from data/journeys.ts) link here using mock ids like "lesson-narrow-path" rather than
  // a real UUID. Querying lessons.id (a uuid column) with a non-UUID string would otherwise throw
  // a Postgres type error -- treat it as a plain not-found instead of a query failure.
  if (!UUID_RE.test(lessonId)) notFound();

  // redirect()/notFound() must never be called from inside a try/catch that doesn't re-throw
  // them (see app/experience-builder/[lessonId]/edit/page.tsx for why) -- every Supabase call
  // happens in the try below, every control-flow decision happens after it, outside the try.
  let userId: string | null = null;
  let lesson: PublishedLesson | null = null;
  let journey: LessonJourney | null = null;
  let items: LessonJourneyItem[] = [];
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      // RLS-gated exactly like the public lesson page: published lessons are visible to anyone,
      // a draft only to its own church's host/admin (who may be previewing the member
      // experience). A nonexistent id and an unauthorized draft both come back null here --
      // deliberately indistinguishable, so an unauthorized visitor can't tell a draft exists.
      lesson = await getLessonById(supabase, lessonId);
      if (lesson) {
        journey = await getOrCreateJourney(supabase, lesson.id);
        items = await getJourneyItems(supabase, journey.id);
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[StudiedStagePage] Failed to load lesson/journey "${lessonId}":`, err);
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
        <ErrorState message="We couldn't load this lesson's journey right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/journey/${lessonId}/studied`)}`);
  if (!lesson) notFound();
  if (!journey) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't start your journey for this lesson right now. Please try again shortly." />
      </div>
    );
  }

  return <StudiedClient lesson={lesson} initialJourney={journey} initialItems={items} />;
}
