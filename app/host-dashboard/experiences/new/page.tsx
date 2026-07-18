import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getMyHostChurches, getChurchMinistries } from "@/services/supabase/churches";
import { ExperienceForm } from "@/components/experiences/ExperienceForm";

export const dynamic = "force-dynamic";

export default async function NewExperiencePage() {
  let churchId = "";
  let ministries: Awaited<ReturnType<typeof getChurchMinistries>> = [];
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const churches = await getMyHostChurches(supabase);
    const church = churches[0];
    if (!church) redirect("/onboarding/church");
    churchId = church.id;
    ministries = await getChurchMinistries(supabase, church.id);
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

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">New Experience</h1>
        <Link href="/host-dashboard/experiences" className="text-xs text-accent-blue-light hover:underline">
          ← Back to Experiences
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Saved as a draft first -- publish it once you&apos;re ready for members to see it.</p>
      <ExperienceForm churchId={churchId} ministries={ministries} />
    </div>
  );
}
