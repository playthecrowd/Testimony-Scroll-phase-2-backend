import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { formatDate } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getEpisodeById, getEpisodes } from "@/services/supabase/episodes";

export const dynamic = "force-dynamic";

export default async function EpisodeDetailPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  const supabase = await createClient();

  let episode;
  let more: Awaited<ReturnType<typeof getEpisodes>> = [];
  try {
    episode = await getEpisodeById(supabase, episodeId);
    if (episode) {
      const all = await getEpisodes(supabase);
      more = all.filter((e) => e.id !== episode!.id).slice(0, 4);
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[EpisodeDetailPage] Failed to load episode "${episodeId}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this episode right now. Please try again shortly." />
      </div>
    );
  }
  // RLS (episodes_select_published_or_admin) means a draft or nonexistent id both come back
  // null for a non-admin visitor -- same "unauthorized and missing look identical" shape used
  // throughout this app.
  if (!episode) notFound();

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.3} />
      <Link href="/episodes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Episodes
      </Link>

      <div className="relative aspect-video rounded-2xl overflow-hidden bg-surface-2 mb-6">
        {episode.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={episode.thumbnailUrl} className="w-full h-full object-cover" alt="" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play size={26} className="text-white ml-1" fill="white" />
          </div>
        </div>
        {episode.durationLabel && (
          <span className="absolute bottom-3 right-3 text-xs bg-black/60 text-white px-2 py-1 rounded">{episode.durationLabel}</span>
        )}
      </div>

      <p className="text-xs text-muted mb-1">
        Season {episode.season} · Episode {episode.episodeNumber}
        {episode.releaseDate && ` · ${formatDate(episode.releaseDate)}`}
      </p>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{episode.title}</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        {episode.topic && <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full text-muted">{episode.topic}</span>}
        {episode.scripture && <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full text-muted">{episode.scripture}</span>}
      </div>
      {episode.description && <p className="text-sm text-muted leading-relaxed mb-6 max-w-2xl">{episode.description}</p>}

      {episode.quote && (
        <blockquote className="border-l-2 border-accent-blue-light pl-4 italic text-sm text-foreground mb-8 max-w-2xl">
          &ldquo;{episode.quote}&rdquo;
          {episode.quoteSource && <span className="block not-italic text-xs text-muted mt-1">— {episode.quoteSource}</span>}
        </blockquote>
      )}

      {episode.characters.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Characters</h2>
          <div className="flex flex-wrap gap-3">
            {episode.characters.map((c) => (
              <Link key={c.id} href={`/characters/${c.id}`} className="flex items-center gap-2 qk-card px-3 py-2 hover:border-accent-blue-light/50">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                )}
                <div>
                  <p className="text-sm text-foreground">{c.name}</p>
                  {c.roleNote && <p className="text-[11px] text-muted">{c.roleNote}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {episode.lessons.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-3">Connected Lessons</h2>
          <div className="flex flex-wrap gap-2">
            {episode.lessons.map((l) => (
              <Link key={l.id} href={`/lessons/${l.slug}`} className="text-xs bg-surface-2 hover:bg-white/10 px-3 py-1.5 rounded-full text-foreground">
                {l.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {more.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-foreground mb-4">More Episodes</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {more.map((ep) => (
              <Link key={ep.id} href={`/episodes/${ep.id}`} className="qk-card overflow-hidden group">
                <div className="aspect-video bg-surface-2">
                  {ep.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ep.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted">EP{ep.episodeNumber}</p>
                  <p className="text-sm font-semibold text-foreground">{ep.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
