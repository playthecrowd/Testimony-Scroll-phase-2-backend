import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { LinkButton } from "@/components/ui/Button";
import { getEpisodes } from "@/services/supabase/episodes";

export const dynamic = "force-dynamic";

export default async function AdminEpisodesPage() {
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

  let episodes: Awaited<ReturnType<typeof getEpisodes>> = [];
  let loadError = "";
  try {
    episodes = await getEpisodes(supabase);
  } catch (err) {
    console.error("[AdminEpisodesPage] Failed to load episodes:", err);
    loadError = "We couldn't load episodes right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Episode Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/characters" className="text-xs text-accent-blue-light hover:underline self-center">
            Character Management →
          </Link>
          <LinkButton href="/admin/episodes/new" size="sm">
            New Episode
          </LinkButton>
        </div>
      </div>
      <p className="text-muted text-sm mb-6">Story episodes -- draft until explicitly published.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : episodes.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No episodes yet.</div>
      ) : (
        <div className="space-y-2.5">
          {episodes.map((ep) => (
            <Link key={ep.id} href={`/admin/episodes/${ep.id}/edit`} className="qk-card p-3.5 flex items-center gap-3 hover:border-accent-blue-light/50">
              {ep.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ep.thumbnailUrl} className="w-14 h-14 rounded-lg object-cover shrink-0" alt="" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  S{ep.season}E{ep.episodeNumber} · {ep.title}
                </p>
                <p className="text-[11px] text-muted truncate">{ep.characters.length} characters · {ep.lessons.length} lessons</p>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  ep.status === "draft" ? "bg-accent-gold/15 text-accent-gold" : "bg-accent-blue/15 text-accent-blue-light"
                }`}
              >
                {ep.status === "draft" ? "Draft" : "Published"}
              </span>
              {ep.featured && <span className="text-[10px] bg-accent-purple/15 text-accent-purple px-2 py-0.5 rounded-full shrink-0">Featured</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
