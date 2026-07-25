import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getExperienceById } from "@/services/supabase/churchExperiences";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { ChurchExperience } from "@/types";
import { OccurrenceForm } from "@/components/experiences/OccurrenceForm";

export const dynamic = "force-dynamic";

export default async function NewOccurrencePage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;

  let userId: string | null = null;
  let experience: ChurchExperience | null = null;
  let churchTimezone: string | null = null;
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
      experience = await getExperienceById(supabase, experienceId);
      if (experience) {
        const { data: membership } = await supabase
          .from("church_memberships")
          .select("role")
          .eq("profile_id", userId)
          .eq("church_id", experience.churchId)
          .maybeSingle();
        role = membership?.role;

        if (hasChurchEditAccess(role)) {
          const { data: church } = await supabase.from("churches").select("timezone").eq("id", experience.churchId).maybeSingle();
          churchTimezone = church?.timezone ?? null;
        }
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[NewOccurrencePage] Failed to load Experience "${experienceId}":`, err);
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
        <ErrorState message="We couldn't load this Experience right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect("/login");
  if (!experience) notFound();

  if (!hasChurchEditAccess(role)) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have permission to schedule occurrences for this Experience.</p>
        <LinkButton href="/host-dashboard/experiences">Go to Experiences</LinkButton>
      </div>
    );
  }

  if (experience.status === "archived") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Archived Experiences cannot receive new occurrences.</p>
        <LinkButton href={`/host-dashboard/experiences/${experience.id}`}>View Experience</LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Schedule Occurrence</h1>
        <Link href={`/host-dashboard/experiences/${experience.id}`} className="text-xs text-accent-blue-light hover:underline">
          ← Back to {experience.title}
        </Link>
      </div>
      <OccurrenceForm experienceId={experience.id} defaultTimezone={churchTimezone} />
    </div>
  );
}
