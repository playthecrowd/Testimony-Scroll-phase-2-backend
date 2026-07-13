import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, ScrollText, Feather } from "lucide-react";
import { getCharacterById } from "@/data/characters";
import { getAllStoryEntries } from "@/services/storyService";
import { getEpisodesByCharacter } from "@/services/episodeService";
import { getTestimonyById } from "@/data/testimonies";
import { formatDate } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const character = getCharacterById(characterId);
  if (!character) return notFound();

  const entries = getAllStoryEntries().filter((e) => e.characterId === character.id);
  const episodes = getEpisodesByCharacter(character.id);
  const testimony = character.testimonyId ? getTestimonyById(character.testimonyId) : undefined;

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.3} />
      <Link href="/characters" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Characters
      </Link>

      <div className="grid md:grid-cols-[280px_1fr] gap-6 mb-8">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden">
          <img src={character.imageUrl} className="w-full h-full object-cover" alt="" />
        </div>
        <div>
          <span className="text-xs text-accent-blue-light font-medium">{character.arcLabel}</span>
          <h1 className="text-3xl font-bold text-foreground mt-1">{character.name}</h1>
          <p className="text-accent-blue-light text-sm mb-3">{character.role}</p>
          <blockquote className="text-sm italic text-foreground border-l-2 border-accent-blue-light pl-3 mb-3">
            &ldquo;{character.quote}&rdquo;
            <span className="block text-xs text-muted not-italic mt-1">— {character.quoteSource}</span>
          </blockquote>
          <p className="text-sm text-muted leading-relaxed mb-3">{character.description}</p>
          <p className="text-sm font-semibold text-foreground mb-1">Story Arc</p>
          <p className="text-sm text-muted leading-relaxed">{character.storyArc}</p>

          {episodes.length > 0 && (
            <Link
              href={`/backstories/${character.id}`}
              className="inline-flex items-center gap-2 mt-5 bg-accent-blue hover:bg-accent-blue-light text-white text-sm font-medium px-4 py-2.5 rounded-lg"
            >
              <Play size={15} /> Play Backstory
            </Link>
          )}
        </div>
      </div>

      {testimony && (
        <div className="qk-card p-4 flex items-center gap-3 mb-8">
          <Feather size={18} className="text-accent-blue-light shrink-0" />
          <p className="text-sm text-muted">
            Generated from the testimony <span className="text-foreground font-medium">&ldquo;{testimony.title}&rdquo;</span> — read it on the{" "}
            <Link href="/kingdom-scroll" className="text-accent-blue-light hover:underline">
              Kingdom Scroll
            </Link>
            .
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ScrollText size={17} className="text-accent-blue-light" /> Related Story Entries
          </h2>
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="qk-card p-4 flex gap-3">
                <img src={e.imageUrl} className="w-20 h-20 rounded-lg object-cover shrink-0" alt="" />
                <div>
                  <p className="text-xs text-muted mb-1">{formatDate(e.date)} · Episode {e.episodeNumber}</p>
                  <p className="text-sm font-semibold text-foreground">{e.title}</p>
                  <p className="text-xs text-muted line-clamp-2">{e.storyText}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {episodes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Related Episodes</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {episodes.map((ep) => (
              <Link key={ep.id} href={`/episodes/${ep.id}`} className="qk-card overflow-hidden group">
                <div className="aspect-video bg-surface-2">
                  <img src={ep.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted">
                    S{ep.season} · EP{ep.episodeNumber}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{ep.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
