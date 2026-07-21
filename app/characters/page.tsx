import Link from "next/link";
import { Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getCharacters } from "@/services/supabase/characters";

export const dynamic = "force-dynamic";

// Real, Supabase-backed as of Phase 7 (docs/PHASE7_AUDIT.md) -- previously data/characters.ts
// (mock), auto-populated by an uncontrolled mock character-generation pipeline. Official
// characters are now exclusively production-admin-curated (/admin/characters).
export default async function CharactersPage() {
  let characters: Awaited<ReturnType<typeof getCharacters>> = [];
  let loadError = "";
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    characters = await getCharacters(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[CharactersPage] Failed to load characters:", err);
    loadError = "We couldn't load characters right now. Please try again shortly.";
  }

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.trailerScreen} opacity={0.35} />
      <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Users2 size={26} className="text-accent-blue-light" /> Story Characters
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">Official Quest for the Kingdom characters, carrying real Kingdom stories forward.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : characters.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No characters yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {characters.map((c) => (
            <Link key={c.id} href={`/characters/${c.id}`} className="group">
              <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-surface-2">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  {c.role && <p className="text-[11px] text-accent-blue-light">{c.role}</p>}
                </div>
                {c.isKeyCharacter && (
                  <span className="absolute top-2 right-2 text-[10px] bg-accent-blue/80 text-white px-2 py-0.5 rounded-full">Key</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
