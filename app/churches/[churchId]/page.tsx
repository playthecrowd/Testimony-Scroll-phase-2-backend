import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users2, CheckCircle2, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublishedChurch } from "@/services/supabase/churches";
import { getPublishedLessonsByChurch } from "@/services/supabase/lessons";
import { PublishedLessonCard } from "@/components/lessons/PublishedLessonCard";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { ErrorState } from "@/components/ui/AsyncState";
import { SupabaseConfigError } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ChurchDetailPage({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params;

  let church;
  let lessons: Awaited<ReturnType<typeof getPublishedLessonsByChurch>> = [];
  try {
    const supabase = await createClient();
    church = await getPublishedChurch(supabase, churchId);
    lessons = church ? await getPublishedLessonsByChurch(supabase, church.id) : [];
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    // Same rule as the churches list page: a failed query (e.g. a column mismatch between code
    // and the connected database) must not crash the whole route, and raw database/query
    // internals must never reach visitors -- log the detail server-side only.
    console.error(`[ChurchDetailPage] Failed to load church "${churchId}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this church right now. Please try again shortly." />
      </div>
    );
  }

  if (!church) notFound();

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.ticketedExperiences} opacity={0.3} />
      <Link href="/churches" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Churches
      </Link>

      <div className="qk-card p-5 md:p-6 flex flex-col sm:flex-row items-start gap-5 mb-6">
        {church.logoUrl && <img src={church.logoUrl} className="w-16 h-16 rounded-2xl" alt="" />}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {church.name} {church.verified && <CheckCircle2 size={16} className="text-accent-blue-light" />}
          </h1>
          <p className="text-sm text-muted mt-1">{[church.city, church.region].filter(Boolean).join(", ")}</p>
          {church.description && <p className="text-sm text-muted mt-3 max-w-2xl">{church.description}</p>}
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Users2 size={13} /> {church.memberCount.toLocaleString()} members
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} /> {lessons.length} lessons captured
            </span>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">Church Archive</h2>
      {lessons.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {lessons.map((l) => (
            <PublishedLessonCard key={l.id} lesson={l} />
          ))}
        </div>
      ) : (
        <div className="qk-card p-10 text-center text-muted text-sm">No lessons captured for this church yet.</div>
      )}
    </div>
  );
}
