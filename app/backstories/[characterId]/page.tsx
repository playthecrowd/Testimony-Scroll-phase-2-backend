import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, ScrollText } from "lucide-react";
import { getCharacterById } from "@/data/characters";
import { getAllStoryEntries } from "@/services/storyService";
import { getEpisodesByCharacter } from "@/services/episodeService";
import { getTestimonyById } from "@/data/testimonies";
import { getLesson } from "@/services/lessonService";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export default async function BackstoryPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const character = getCharacterById(characterId);
  if (!character) return notFound();

  const entries = getAllStoryEntries().filter((e) => e.characterId === character.id);
  const episodes = getEpisodesByCharacter(character.id);
  const testimony = character.testimonyId ? getTestimonyById(character.testimonyId) : undefined;
  const relatedLessons = Array.from(new Set(entries.flatMap((e) => e.lessonIds)))
    .map((id) => getLesson(id))
    .filter(Boolean);
  const nextEpisode = episodes[0];

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.chooseHowToJoin} opacity={0.35} />
      <Link href={`/characters/${character.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Return to Story
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-surface-2 mb-4">
            <img src={character.imageUrl} className="w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                <Play size={26} className="text-white ml-1" fill="white" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <img src={character.imageUrl} className="w-12 h-12 rounded-full object-cover" alt="" />
            <div>
              <h1 className="text-xl font-bold text-foreground">{character.name}</h1>
              <p className="text-xs text-accent-blue-light">{character.role} — Backstory</p>
            </div>
          </div>
          <p className="text-sm text-muted leading-relaxed mb-4">{character.description}</p>
          <p className="text-sm font-semibold text-foreground mb-1">Story Journey</p>
          <p className="text-sm text-muted leading-relaxed">{character.storyArc}</p>
        </div>

        <aside className="space-y-4">
          {testimony && (
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Related Testimony Source</h3>
              <Link href="/kingdom-scroll" className="text-xs text-accent-blue-light hover:underline">
                &ldquo;{testimony.title}&rdquo;
              </Link>
            </div>
          )}

          {relatedLessons.length > 0 && (
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Related Lessons</h3>
              <div className="space-y-1.5">
                {relatedLessons.map((l) => (
                  <Link key={l!.id} href={`/lessons/${l!.slug}`} className="block text-xs text-muted hover:text-accent-blue-light">
                    {l!.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {episodes.length > 0 && (
            <div className="qk-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Related Episodes</h3>
              <div className="space-y-1.5">
                {episodes.map((ep) => (
                  <Link key={ep.id} href={`/episodes/${ep.id}`} className="block text-xs text-muted hover:text-accent-blue-light">
                    Episode {ep.episodeNumber} · {ep.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {nextEpisode && (
            <Link href={`/episodes/${nextEpisode.id}`} className="qk-card p-4 flex items-center justify-between text-sm text-foreground hover:border-accent-blue-light">
              Next Episode
              <ScrollText size={15} className="text-accent-blue-light" />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
