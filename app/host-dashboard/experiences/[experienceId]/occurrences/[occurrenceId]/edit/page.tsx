import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getOccurrenceById } from "@/services/supabase/churchExperiences";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { ChurchExperienceOccurrence } from "@/types";
import { OccurrenceForm } from "@/components/experiences/OccurrenceForm";

export const dynamic = "force-dynamic";

export default async function EditOccurrencePage({ params }: { params: Promise<{ experienceId: string; occurrenceId: string }> }) {
  const { experienceId, occurrenceId } = await params;

  let userId: string | null = null;
  let occurrence: ChurchExperienceOccurrence | null = null;
  let role: string | null | undefined;
  let configError: SupabaseConfigError | null = null;
  let loadFailed = false;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      occurrence = await getOccurrenceById(supabase, occurrenceId);
      if (occurrence && occurrence.experienceId === experienceId) {
        const { data: membership } = await supabase
          .from("church_memberships")
          .select("role")
          .eq("profile_id", userId)
          .eq("church_id", occurrence.churchId)
          .maybeSingle();
        role = membership?.role;
      } else {
        occurrence = null;
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[EditOccurrencePage] Failed to load occurrence "${occurrenceId}":`, err);
      loadFailed = true;
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }
  if (loadFailed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this occurrence right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect("/login");
  if (!occurrence) notFound();

  if (!hasChurchEditAccess(role)) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have permission to edit this occurrence.</p>
        <LinkButton href="/host-dashboard/experiences">Go to Experiences</LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Occurrence</h1>
        <Link href={`/host-dashboard/experiences/${experienceId}/occurrences/${occurrenceId}`} className="text-xs text-accent-blue-light hover:underline">
          ← Back to Occurrence
        </Link>
      </div>
      <OccurrenceForm experienceId={experienceId} defaultTimezone={occurrence.timezone} occurrence={occurrence} />
    </div>
  );
}
