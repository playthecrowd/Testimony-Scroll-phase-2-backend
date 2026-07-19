import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { EventsQueueList } from "@/components/admin/EventsQueueList";
import { getPendingEvents } from "@/services/supabase/events";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
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

  let events: Awaited<ReturnType<typeof getPendingEvents>> = [];
  let loadError = "";
  try {
    events = await getPendingEvents(supabase);
  } catch (err) {
    console.error("[AdminEventsPage] Failed to load events:", err);
    loadError = "We couldn't load event requests right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Event Moderation</h1>
        <div className="flex gap-3">
          <Link href="/admin/episodes" className="text-xs text-accent-blue-light hover:underline self-center">
            Episodes →
          </Link>
          <Link href="/admin/testimonies" className="text-xs text-accent-blue-light hover:underline self-center">
            Testimonies →
          </Link>
        </div>
      </div>
      <p className="text-muted text-sm mb-6">Event requests awaiting review, approval, or calendar publication.</p>
      {loadError ? <ErrorState message={loadError} /> : <EventsQueueList events={events} />}
    </div>
  );
}
