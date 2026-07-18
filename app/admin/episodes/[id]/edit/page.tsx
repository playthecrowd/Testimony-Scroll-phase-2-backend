import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { EpisodeForm } from "@/components/admin/EpisodeForm";
import { EpisodeCharactersEditor } from "@/components/admin/EpisodeCharactersEditor";
import { EpisodeLessonsEditor } from "@/components/admin/EpisodeLessonsEditor";
import { EpisodePublishToggle } from "@/components/admin/EpisodePublishToggle";
import { getEpisodeById } from "@/services/supabase/episodes";
import { getCharacters } from "@/services/supabase/characters";
import { getPublishedLessons } from "@/services/supabase/lessons";

export const dynamic = "force-dynamic";

export default async function EditEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const [episode, allCharacters, publishedLessons] = await Promise.all([
    getEpisodeById(supabase, id),
    getCharacters(supabase),
    getPublishedLessons(supabase),
  ]);
  if (!episode) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/admin/episodes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Episodes
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Edit S{episode.season}E{episode.episodeNumber} · {episode.title}
        </h1>
        <EpisodePublishToggle episodeId={episode.id} status={episode.status} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <EpisodeForm episode={episode} />
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Characters in This Episode</h2>
            <EpisodeCharactersEditor episodeId={episode.id} allCharacters={allCharacters} initialSelections={episode.characters} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Connected Lessons</h2>
            <EpisodeLessonsEditor episodeId={episode.id} publishedLessons={publishedLessons} initialSelections={episode.lessons} />
          </div>
        </div>
      </div>
    </div>
  );
}
