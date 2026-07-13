import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { getEpisode, getAllEpisodes } from "@/services/episodeService";
import { getCharacterById } from "@/data/characters";
import { formatDate } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default async function EpisodeDetailPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  const episode = getEpisode(episodeId);
  if (!episode) return notFound();
  const character = getCharacterById(episode.mainCharacterId);
  const more = getAllEpisodes()
    .filter((e) => e.id !== episode.id)
    .slice(0, 4);

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.3} />
      <Link href="/episodes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Episodes
      </Link>

      <div className="relative aspect-video rounded-2xl overflow-hidden bg-surface-2 mb-6">
        <img src={episode.thumbnailUrl} className="w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play size={26} className="text-white ml-1" fill="white" />
          </div>
        </div>
        <span className="absolute bottom-3 right-3 text-xs bg-black/60 text-white px-2 py-1 rounded">{episode.durationLabel}</span>
      </div>

      <p className="text-xs text-muted mb-1">
        Season {episode.season} · Episode {episode.episodeNumber} · {formatDate(episode.releaseDate)}
      </p>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{episode.title}</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full text-muted">{episode.topic}</span>
        <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full text-muted">{episode.scripture}</span>
        <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full text-muted">{episode.storyArc}</span>
      </div>
      <p className="text-sm text-muted leading-relaxed mb-6 max-w-2xl">{episode.description}</p>

      {episode.quote && (
        <blockquote className="border-l-2 border-accent-blue-light pl-4 italic text-sm text-foreground mb-8 max-w-2xl">
          &ldquo;{episode.quote}&rdquo;
          <span className="block not-italic text-xs text-muted mt-1">— {episode.quoteSource}</span>
        </blockquote>
      )}

      {character && (
        <Link href={`/backstories/${character.id}`} className="inline-flex items-center gap-2 bg-accent-blue hover:bg-accent-blue-light text-white text-sm font-medium px-4 py-2.5 rounded-lg mb-10">
          <Play size={15} /> Play Backstory
        </Link>
      )}

      <h2 className="text-lg font-semibold text-foreground mb-4">More Episodes</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {more.map((ep) => (
          <Link key={ep.id} href={`/episodes/${ep.id}`} className="qk-card overflow-hidden group">
            <div className="aspect-video bg-surface-2">
              <img src={ep.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
            </div>
            <div className="p-3">
              <p className="text-xs text-muted">EP{ep.episodeNumber}</p>
              <p className="text-sm font-semibold text-foreground">{ep.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
