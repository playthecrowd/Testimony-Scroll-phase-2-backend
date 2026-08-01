import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLessonBySlug } from "@/services/supabase/lessons";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LessonDetailClient } from "./LessonDetailClient";

export const dynamic = "force-dynamic";

// Server Component: the RLS-aware fetch happens here (using the cookie-bound server client,
// so the query is "viewer-aware" -- a public visitor only gets a published row back, an
// authorized host also gets their own draft), and next/navigation's notFound() only works
// from a Server Component. Interactive bits (tabs, journey CTA) live in the client component.
export default async function LessonDetailPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  let lesson;
  try {
    const supabase = await createClient();
    lesson = await getLessonBySlug(supabase, lessonId);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    // Same rule as the churches pages: a failed query (e.g. a column mismatch between code and
    // the connected database) must not crash the whole route, and raw database/query internals
    // must never reach visitors -- log the detail server-side only.
    console.error(`[LessonDetailPage] Failed to load lesson "${lessonId}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this lesson right now. Please try again shortly." />
      </div>
    );
  }

  if (!lesson) notFound();

  // LessonDetailClient never renders questions (they belong only to the Study flow, per
  // docs/REQUIRED_FEATURES.md) -- but a client component's props still get serialized into the
  // page's RSC payload regardless of which fields its JSX actually reads. Overriding to an empty
  // array here means the question/choice text itself never reaches this public page's HTML or
  // network payload, not just that the UI declines to display it.
  return <LessonDetailClient lesson={{ ...lesson, questions: [] }} />;
}
