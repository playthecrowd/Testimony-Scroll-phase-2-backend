import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { getLessonById } from "@/services/supabase/lessons";
import { PublishedLesson } from "@/types";
import { CampaignLessonForm } from "../../CampaignLessonForm";

export const dynamic = "force-dynamic";

export default async function EditCampaignLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string | null = null;
  let isPlatformAdmin = false;
  let lesson: PublishedLesson | null = null;
  let loadFailed = false;
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    const gate = await getPlatformAdminGate(supabase);
    userId = gate.userId;
    isPlatformAdmin = gate.isPlatformAdmin;
    if (isPlatformAdmin) {
      lesson = await getLessonById(supabase, id);
    }
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[EditCampaignLessonPage] Failed to load campaign lesson "${id}":`, err);
    loadFailed = true;
  }

  if (!userId) redirect("/login");
  if (!isPlatformAdmin) return <NotAuthorized />;
  if (loadFailed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this campaign lesson right now. Please try again shortly." />
      </div>
    );
  }
  // A lesson id that isn't a campaign lesson (e.g. a church-authored one) has no place in this
  // admin-only campaign editor -- treat it as not found rather than let an admin accidentally
  // edit a church's own lesson through the wrong form.
  if (!lesson || !lesson.isCampaignLesson) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/admin/campaign-lessons" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Campaign Lessons
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Edit Campaign Lesson</h1>
      <CampaignLessonForm lesson={lesson} />
    </div>
  );
}
