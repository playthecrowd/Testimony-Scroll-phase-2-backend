import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getTestimonyById, getTestimonyLikeInfo } from "@/services/supabase/testimonies";
import { getYouTubeEmbedUrl } from "@/lib/videoEmbed";
import { LikeButton } from "@/components/kingdomScroll/LikeButton";

export const dynamic = "force-dynamic";

// Real, deep-linkable detail page (Part 14 flagged the old inline-drawer-only approach as unable
// to be shared/linked to directly). "View Related Lesson" below just works, automatically, since
// this testimony references a real lessons.id -- no special-casing needed.
export default async function TestimonyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let testimony;
  let likeInfo = { count: 0, likedByMe: false };
  try {
    testimony = await getTestimonyById(supabase, id);
    if (testimony) likeInfo = await getTestimonyLikeInfo(supabase, id);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[TestimonyDetailPage] Failed to load testimony "${id}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this testimony right now. Please try again shortly." />
      </div>
    );
  }

  // RLS (testimonies_select_public_approved) means a non-approved or nonexistent id both come
  // back null here -- same "unauthorized and missing look identical" shape as lessons/churches.
  if (!testimony) notFound();

  const videoEmbedUrl = testimony.videoUrl ? getYouTubeEmbedUrl(testimony.videoUrl) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/kingdom-scroll" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Kingdom Scroll
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{testimony.title}</h1>
      <p className="text-muted text-sm mb-5">
        {testimony.displayName || "A Kingdom Member"} · {testimony.churchName || "Quest for the Kingdom"}
        {testimony.topic && ` · ${testimony.topic}`}
      </p>

      {videoEmbedUrl && (
        <div className="aspect-video rounded-lg overflow-hidden bg-surface-2 mb-5">
          <iframe
            src={videoEmbedUrl}
            title="Testimony video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {!videoEmbedUrl && testimony.videoUrl && (
        <a href={testimony.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue-light hover:underline block mb-5">
          Watch video
        </a>
      )}

      <div className="qk-card p-5 mb-5">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{testimony.writtenTestimony}</p>
        {testimony.scripture && <p className="text-xs text-muted mt-4">Scripture: {testimony.scripture}</p>}
        {testimony.audioUrl && (
          <a href={testimony.audioUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-blue-light hover:underline block mt-2">
            Listen to audio
          </a>
        )}
      </div>

      {testimony.suggestedCharacter && (
        <p className="text-xs text-muted mb-5">Suggested character connection: {testimony.suggestedCharacter}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <LikeButton testimonyId={testimony.id} initialCount={likeInfo.count} initialLiked={likeInfo.likedByMe} />
        {testimony.primaryLessonSlug && (
          <LinkButton href={`/lessons/${testimony.primaryLessonSlug}`} variant="secondary" size="sm">
            <BookOpen size={14} /> View Related Lesson
          </LinkButton>
        )}
      </div>
    </div>
  );
}
