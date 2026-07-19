import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { ChurchesVerifyList } from "@/components/admin/ChurchesVerifyList";
import { getAllChurchesForAdmin } from "@/services/supabase/churches";

export const dynamic = "force-dynamic";

// Sixth real admin page (Phase 9, docs/PHASE9_AUDIT.md) -- churches.verified has existed since
// Milestone One and is already shown publicly as a checkmark badge, but nothing anywhere could
// set it except the seed script until now.
export default async function AdminChurchesPage() {
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

  let churches: Awaited<ReturnType<typeof getAllChurchesForAdmin>> = [];
  let loadError = "";
  try {
    churches = await getAllChurchesForAdmin(supabase);
  } catch (err) {
    console.error("[AdminChurchesPage] Failed to load churches:", err);
    loadError = "We couldn't load churches right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Church Verification</h1>
        <Link href="/admin" className="text-xs text-accent-blue-light hover:underline">
          ← Admin Home
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Mark a church as verified/trusted. Shown publicly as a checkmark on its church page.</p>
      {loadError ? <ErrorState message={loadError} /> : <ChurchesVerifyList churches={churches} />}
    </div>
  );
}
