import { redirect } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyChurches, getChurchMinistries } from "@/services/supabase/churches";
import { getPublishedExperiencesForMember } from "@/services/supabase/churchExperiences";
import { ExperiencesBrowser } from "@/components/experiences/ExperiencesBrowser";
import { ChurchExperience, ChurchMinistry } from "@/types";

export const dynamic = "force-dynamic";

// Member Experience discovery (Phase 10.3, checkpoint 5). Church-scoped only -- owner decision 4
// of 10 (2026-07-18): no public/cross-church discovery, no anonymous browsing. A signed-out
// visitor gets the same sign-in-required treatment as /dashboard and /my-journey, never a public
// list and never a 404.
export default async function ExperiencesPage() {
  let experiences: ChurchExperience[] = [];
  let ministries: ChurchMinistry[] = [];
  let loadError = "";
  let noChurches = false;
  let configError: SupabaseConfigError | null = null;
  // createClient() and the data-loading below each get their own try/catch so a thrown redirect()
  // signal (Next.js's internal control-flow throw) never lands inside a catch that would swallow
  // it and misreport a signed-out visit as a generic load failure. createClient() itself throws
  // SupabaseConfigError when env vars are missing -- it must stay inside its own try, or that
  // error would be an uncaught 500 instead of the graceful branded error state below.
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[ExperiencesPage] Failed to initialize Supabase client:", err);
      loadError = "We couldn't load Experiences right now. Please try again shortly.";
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }
  if (loadError || !supabase) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={loadError || "We couldn't load Experiences right now. Please try again shortly."} />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fexperiences");

  try {
    const churches = await getMyChurches(supabase);
    if (churches.length === 0) {
      noChurches = true;
    } else {
      const churchIds = churches.map((c) => c.id);
      [experiences, ministries] = await Promise.all([
        getPublishedExperiencesForMember(supabase, churchIds),
        Promise.all(churchIds.map((id) => getChurchMinistries(supabase, id))).then((lists) => {
          const seen = new Map<string, ChurchMinistry>();
          for (const list of lists) for (const m of list) seen.set(m.id, m);
          return Array.from(seen.values());
        }),
      ]);
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      configError = err;
    } else {
      console.error("[ExperiencesPage] Failed to load Experiences:", err);
      loadError = "We couldn't load Experiences right now. Please try again shortly.";
    }
  }

  if (configError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message={configError.message} />
      </div>
    );
  }

  if (noChurches) {
    // A signed-in user with no church membership at all simply has nothing church-scoped to
    // discover yet -- not an error, just an empty result.
    return (
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2 mb-1">
          <HeartHandshake size={24} className="text-accent-blue-light" /> Experiences
        </h1>
        <p className="text-muted text-sm">Join a church to discover Experiences.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <HeartHandshake size={24} className="text-accent-blue-light" /> Experiences
          </h1>
          <p className="text-muted text-sm mt-1 mb-5">Discover discipleship Experiences from your church.</p>
        </div>
        <LinkButton href="/my-experiences" variant="secondary" size="sm">
          My Experiences
        </LinkButton>
      </div>
      {loadError ? <ErrorState message={loadError} /> : <ExperiencesBrowser experiences={experiences} ministries={ministries} />}
    </div>
  );
}
