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
    throw err;
  }

  if (!lesson) notFound();

  return <LessonDetailClient lesson={lesson} />;
}
