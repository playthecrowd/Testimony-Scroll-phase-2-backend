import Link from "next/link";
import { Play, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getEpisodes } from "@/services/supabase/episodes";
import { EpisodesList } from "./EpisodesList";

export const dynamic = "force-dynamic";

// Real, Supabase-backed as of Phase 7 (docs/PHASE7_AUDIT.md) -- previously data/episodes.ts
// (mock). getEpisodes relies on RLS to only return published rows to a public visitor, so no
// draft ever reaches this page.
export default async function EpisodesPage() {
  let episodes: Awaited<ReturnType<typeof getEpisodes>> = [];
  let loadError = "";
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    episodes = await getEpisodes(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[EpisodesPage] Failed to load episodes:", err);
    loadError = "We couldn't load episodes right now. Please try again shortly.";
  }

  const featured = episodes.find((e) => e.featured) ?? null;
  const rest = featured ? episodes.filter((e) => e.id !== featured.id) : episodes;

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.4} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground">Episodes</h1>
      <p className="text-muted text-sm mt-1 mb-5">Story episodes built from the Quest for the Kingdom Scroll.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          {featured && (
            <Link href={`/episodes/${featured.id}`} className="qk-card overflow-hidden md:flex mb-6 group">
              <div className="relative md:w-[55%] aspect-video bg-surface-2">
                {featured.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featured.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                )}
                <span className="absolute top-3 left-3 flex items-center gap-1 text-[11px] bg-accent-gold/90 text-[#231607] px-2 py-0.5 rounded-full font-semibold">
                  <Star size={11} /> Featured Episode
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1">
                <p className="text-xs text-muted mb-1">
                  Episode {featured.episodeNumber} · Season {featured.season}
                </p>
                <h2 className="text-2xl font-bold text-foreground mb-2">{featured.title}</h2>
                {featured.topic && <span className="text-[11px] bg-surface-2 px-2 py-0.5 rounded-full text-muted">{featured.topic}</span>}
                <p className="text-sm text-muted leading-relaxed mt-3">{featured.description}</p>
              </div>
            </Link>
          )}

          <h2 className="text-lg font-semibold text-foreground mb-4">All Episodes ({rest.length})</h2>
          <EpisodesList episodes={rest} />
        </>
      )}
    </div>
  );
}
