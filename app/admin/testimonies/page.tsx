import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { getPendingPublicTestimonies } from "@/services/supabase/testimonies";
import { PublicTestimoniesList } from "@/components/admin/PublicTestimoniesList";

export const dynamic = "force-dynamic";

export default async function AdminTestimoniesPage() {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
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

  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", userId).maybeSingle();
  if (!profile?.is_platform_admin) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You don&apos;t have access to this page.</p>
        <p className="text-muted text-sm">This area is restricted to Quest for the Kingdom production administrators.</p>
      </div>
    );
  }

  let testimonies: Awaited<ReturnType<typeof getPendingPublicTestimonies>> = [];
  let loadError = "";
  try {
    testimonies = await getPendingPublicTestimonies(supabase);
  } catch (err) {
    console.error("[AdminTestimoniesPage] Failed to load public testimonies:", err);
    loadError = "We couldn't load public testimonies right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Testimony Moderation</h1>
        <Link href="/admin/lesson-requests" className="text-xs text-accent-blue-light hover:underline">
          Lesson Request Moderation →
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Public testimonies already approved by their church, awaiting Kingdom Scroll approval.</p>
      {loadError ? <ErrorState message={loadError} /> : <PublicTestimoniesList testimonies={testimonies} />}
    </div>
  );
}
