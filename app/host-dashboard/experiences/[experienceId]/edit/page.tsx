import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getExperienceById } from "@/services/supabase/churchExperiences";
import { getChurchMinistries } from "@/services/supabase/churches";
import { hasChurchEditAccess } from "@/lib/lessonAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { ChurchExperience, ChurchMinistry } from "@/types";
import { ExperienceForm } from "@/components/experiences/ExperienceForm";

export const dynamic = "force-dynamic";

// Same shape as app/experience-builder/[lessonId]/edit/page.tsx: redirect()/notFound() must never
// be called from inside a try/catch that doesn't re-throw them, so every Supabase call happens in
// the try below and every control-flow decision happens after it, outside the try entirely.
export default async function EditExperiencePage({ params }: { params: Promise<{ experienceId: string }> }) {
  const { experienceId } = await params;

  let userId: string | null = null;
  let experience: ChurchExperience | null = null;
  let ministries: ChurchMinistry[] = [];
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
      // RLS-gated: a published Experience is visible to any member of its church, a draft only to
      // its own church's host/admin -- a nonexistent OR unauthorized-draft lookup both come back
      // null here.
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
          ministries = await getChurchMinistries(supabase, experience.churchId);
        }
      }
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error(`[EditExperiencePage] Failed to load Experience "${experienceId}":`, err);
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
        <ErrorState message="We couldn't load this Experience for editing right now. Please try again shortly." />
      </div>
    );
  }
  if (!userId) redirect("/login");
  if (!experience) notFound();

  if (!hasChurchEditAccess(role)) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have permission to edit this Experience.</p>
        <p className="text-muted text-sm mb-6">Only a Host or Admin of this church can edit it.</p>
        <LinkButton href="/host-dashboard/experiences">Go to Experiences</LinkButton>
      </div>
    );
  }

  if (experience.status === "archived") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">This Experience is archived.</p>
        <p className="text-muted text-sm mb-6">Restore it to draft from its detail page before editing.</p>
        <LinkButton href={`/host-dashboard/experiences/${experience.id}`}>View Experience</LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Edit Experience</h1>
      <p className="text-muted text-sm mb-6">{experience.title}</p>
      <ExperienceForm churchId={experience.churchId} ministries={ministries} experience={experience} />
    </div>
  );
}
