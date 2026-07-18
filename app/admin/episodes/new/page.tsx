import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { EpisodeForm } from "@/components/admin/EpisodeForm";

export const dynamic = "force-dynamic";

export default async function NewEpisodePage() {
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

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/admin/episodes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Episodes
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">New Episode</h1>
      <p className="text-muted text-sm mb-6">Saved as a draft -- connect characters/lessons and publish from the edit page.</p>
      <EpisodeForm />
    </div>
  );
}
