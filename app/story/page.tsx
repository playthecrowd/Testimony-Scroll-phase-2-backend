import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getEpisodes } from "@/services/supabase/episodes";
import { getCharacters } from "@/services/supabase/characters";
import { FullStoryView } from "./FullStoryView";

export const dynamic = "force-dynamic";

// Real, Supabase-backed as of Phase 7 (docs/PHASE7_AUDIT.md). Fixes the confirmed defect found
// during the Phase 7 audit: the old mock page's Book View and Timeline View rendered identical
// markup (both fell into the same "else" branch). Book View is now a real sequential chapter
// reader (one episode at a time, Previous/Next); Timeline View keeps the chronological list
// presentation -- genuinely two different experiences over the same data.
export default async function FullStoryPage() {
  const supabase = await createClient();

  let episodes: Awaited<ReturnType<typeof getEpisodes>> = [];
  let characters: Awaited<ReturnType<typeof getCharacters>> = [];
  let loadError = "";
  try {
    [episodes, characters] = await Promise.all([getEpisodes(supabase), getCharacters(supabase)]);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[FullStoryPage] Failed to load episodes/characters:", err);
    loadError = "We couldn't load the Full Story right now. Please try again shortly.";
  }

  const completion = episodes.length === 0 ? 0 : Math.round((episodes.length / Math.max(episodes.length, 5)) * 100);

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.chooseHowToJoin} opacity={0.3} />
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">The Full Kingdom Story</h1>
          <p className="text-muted text-sm mt-1">One story. Many lives. All leading to the King.</p>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted">
            <span>
              <span className="text-foreground font-semibold">{episodes.length}</span> Episodes
            </span>
            <span>
              <span className="text-foreground font-semibold">{characters.length}</span> Characters
            </span>
          </div>
        </div>
        <div className="qk-card px-4 py-3 text-center shrink-0">
          <p className="text-[11px] text-muted">Story Progress</p>
          <p className="text-2xl font-bold text-accent-blue-light">{Math.min(completion, 100)}%</p>
        </div>
      </div>

      {loadError ? <ErrorState message={loadError} /> : <FullStoryView episodes={episodes} characters={characters} />}
    </div>
  );
}
