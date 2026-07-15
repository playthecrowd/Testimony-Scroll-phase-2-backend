import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyHostChurches } from "@/services/supabase/churches";
import { getManagedLessonsByChurch } from "@/services/supabase/lessons";
import { HostLessonManagementList } from "@/components/lessons/HostLessonManagementList";
import { PublishedLesson } from "@/types";
import { ExperienceBuilderForm } from "./ExperienceBuilderForm";

export const dynamic = "force-dynamic";

// Server-side guard, re-checked on every request (fresh signup, login, or a restored session
// hitting this URL directly all go through the same path): unauthenticated -> /login,
// non-host -> /dashboard, host with no church yet -> /onboarding/church. The client component
// below keeps its own checks too, but a Kingdom Member or churchless Host should never even
// receive the form markup in the first place.
export default async function ExperienceBuilderPage() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.account_type !== "host") redirect("/dashboard");

    const { count } = await supabase
      .from("church_memberships")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"]);

    if (!count) redirect("/onboarding/church");
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

  // Past this point the Host is authenticated and manages at least one church. Loading their
  // lesson-management list is a separate, non-fatal step -- a failure here must not crash the
  // whole builder page (the create form below still needs to render).
  let managedLessons: PublishedLesson[] = [];
  let managementLoadError = "";
  try {
    const churches = await getMyHostChurches(supabase);
    const lessonLists = await Promise.all(churches.map((c) => getManagedLessonsByChurch(supabase, c.id)));
    managedLessons = lessonLists.flat().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch (err) {
    console.error("[ExperienceBuilderPage] Failed to load managed lessons:", err);
    managementLoadError = "We couldn't load your lessons right now. Please try again shortly.";
  }

  return (
    <>
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-6 md:pt-8">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-1">Your Lessons</h2>
          <p className="text-muted text-sm mb-4">Manage the lesson experiences you&apos;ve built.</p>
          {managementLoadError ? <ErrorState message={managementLoadError} /> : <HostLessonManagementList lessons={managedLessons} />}
        </section>
      </div>
      <ExperienceBuilderForm />
    </>
  );
}
