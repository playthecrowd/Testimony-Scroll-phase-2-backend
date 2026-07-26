import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { CampaignLessonImportClient } from "../CampaignLessonImportClient";

export const dynamic = "force-dynamic";

export default async function ImportCampaignLessonsPage() {
  // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
  // inside this try so that failure renders the graceful branded error state below.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let gate;
  try {
    supabase = await createClient();
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
    <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/admin/campaign-lessons" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Campaign Lessons
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Bulk Upload Campaign Lessons</h1>
      <p className="text-muted text-sm mb-6">Import Year-Round Campaign Lessons from a CSV file.</p>
      <CampaignLessonImportClient />
    </div>
  );
}
