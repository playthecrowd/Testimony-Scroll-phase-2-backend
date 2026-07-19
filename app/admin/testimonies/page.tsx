import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { getPendingPublicTestimonies, getApprovedPublicTestimonies } from "@/services/supabase/testimonies";
import { PublicTestimoniesList } from "@/components/admin/PublicTestimoniesList";
import { ApprovedTestimoniesFeaturedList } from "@/components/admin/ApprovedTestimoniesFeaturedList";

export const dynamic = "force-dynamic";

export default async function AdminTestimoniesPage() {
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

  let pendingTestimonies: Awaited<ReturnType<typeof getPendingPublicTestimonies>> = [];
  let approvedTestimonies: Awaited<ReturnType<typeof getApprovedPublicTestimonies>> = [];
  let loadError = "";
  try {
    [pendingTestimonies, approvedTestimonies] = await Promise.all([
      getPendingPublicTestimonies(supabase),
      getApprovedPublicTestimonies(supabase),
    ]);
  } catch (err) {
    console.error("[AdminTestimoniesPage] Failed to load testimonies:", err);
    loadError = "We couldn't load testimonies right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Testimony Moderation</h1>
        <Link href="/admin" className="text-xs text-accent-blue-light hover:underline">
          ← Admin Home
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Public testimonies already approved by their church, awaiting Kingdom Scroll approval.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Awaiting Platform Approval</h2>
            <PublicTestimoniesList testimonies={pendingTestimonies} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Feature on Kingdom Scroll</h2>
            <ApprovedTestimoniesFeaturedList testimonies={approvedTestimonies} />
          </div>
        </div>
      )}
    </div>
  );
}
