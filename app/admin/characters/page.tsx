import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { LinkButton } from "@/components/ui/Button";
import { getCharacters } from "@/services/supabase/characters";

export const dynamic = "force-dynamic";

export default async function AdminCharactersPage() {
  const supabase = await createClient();

  let gate;
  try {
    gate = await getPlatformAdminGate(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    throw err;
  }

  if (!gate.userId) redirect("/login");
  if (!gate.isPlatformAdmin) return <NotAuthorized />;

  let characters: Awaited<ReturnType<typeof getCharacters>> = [];
  let loadError = "";
  try {
    characters = await getCharacters(supabase);
  } catch (err) {
    console.error("[AdminCharactersPage] Failed to load characters:", err);
    loadError = "We couldn't load characters right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Character Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/episodes" className="text-xs text-accent-blue-light hover:underline self-center">
            Episode Management →
          </Link>
          <LinkButton href="/admin/characters/new" size="sm">
            New Character
          </LinkButton>
        </div>
      </div>
      <p className="text-muted text-sm mb-6">Official Quest for the Kingdom story characters.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : characters.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No characters yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((c) => (
            <Link key={c.id} href={`/admin/characters/${c.id}/edit`} className="qk-card p-4 flex items-center gap-3 hover:border-accent-blue-light/50">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted truncate">{c.role}</p>
              </div>
              {c.isKeyCharacter && <span className="ml-auto text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full shrink-0">Key</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
