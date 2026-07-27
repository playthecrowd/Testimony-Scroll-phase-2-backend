import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScrollText, Feather, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getCharacterById } from "@/services/supabase/characters";
import { CharacterAvatarImage } from "@/components/characters/CharacterAvatarImage";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";

export const dynamic = "force-dynamic";

export default async function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const supabase = await createClient();

  let character;
  try {
    character = await getCharacterById(supabase, characterId);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[CharacterDetailPage] Failed to load character "${characterId}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this character right now. Please try again shortly." />
      </div>
    );
  }
  if (!character) notFound();

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.3} />
      <Link href="/characters" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Characters
      </Link>

      <div className="grid md:grid-cols-[280px_1fr] gap-6 mb-8">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-surface-2">
          <CharacterAvatarImage src={character.imageUrl} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mt-1">{character.name}</h1>
          {character.role && <p className="text-accent-blue-light text-sm mb-3">{character.role}</p>}
          {character.quote && (
            <blockquote className="text-sm italic text-foreground border-l-2 border-accent-blue-light pl-3 mb-3">
              &ldquo;{character.quote}&rdquo;
              {character.quoteSource && <span className="block text-xs text-muted not-italic mt-1">— {character.quoteSource}</span>}
            </blockquote>
          )}
          {character.description && <p className="text-sm text-muted leading-relaxed">{character.description}</p>}
        </div>
      </div>

      {character.testimonies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Feather size={17} className="text-accent-blue-light" /> Contributing Testimonies
          </h2>
          <div className="space-y-3">
            {character.testimonies.map((t) => (
              <Link key={t.id} href={`/kingdom-scroll/${t.id}`} className="qk-card p-4 flex items-center gap-3 hover:border-accent-blue-light/50">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.title}</p>
                  {t.note && <p className="text-xs text-muted mt-0.5">{t.note}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {character.episodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ScrollText size={17} className="text-accent-blue-light" /> Related Episodes
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {character.episodes.map((ep) => (
              <Link key={ep.id} href={`/episodes/${ep.id}`} className="qk-card p-3.5 hover:border-accent-blue-light/50">
                <p className="text-xs text-muted">
                  S{ep.season} · EP{ep.episodeNumber}
                </p>
                <p className="text-sm font-semibold text-foreground">{ep.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Derived through the character's episodes (episode_lessons), not a direct link -- see
          services/supabase/characters.ts. Only appears once the character has at least one
          episode with lessons attached. */}
      {character.relatedLessons.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BookOpen size={17} className="text-accent-blue-light" /> Related Lessons
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {character.relatedLessons.map((lesson) => (
              <Link key={lesson.id} href={`/lessons/${lesson.slug}`} className="qk-card p-3.5 hover:border-accent-blue-light/50">
                <p className="text-sm font-semibold text-foreground">{lesson.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {character.testimonies.length === 0 && character.episodes.length === 0 && character.relatedLessons.length === 0 && (
        <p className="text-sm text-muted">This character&apos;s story is still unfolding.</p>
      )}
    </div>
  );
}
