import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Video, Users2, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { formatDate } from "@/lib/utils";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getEventById } from "@/services/supabase/events";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  pop_up_virtual: "Pop-up Virtual",
  pop_up_physical: "Pop-up Physical",
  ticketed: "Ticketed",
  game_day: "Game Day",
  church_hosted: "Church-Hosted",
  kingdom_scroll: "Kingdom Scroll",
};

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let event;
  try {
    event = await getEventById(supabase, id);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error(`[EventDetailPage] Failed to load event "${id}":`, err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load this event right now. Please try again shortly." />
      </div>
    );
  }
  // RLS (events_select_published) means a non-published or nonexistent id both come back null
  // for a public visitor -- same "unauthorized and missing look identical" shape used throughout.
  if (!event) notFound();

  return (
    <div className="relative max-w-2xl mx-auto px-4 py-8">
      <PageBackground src={backgrounds.featuredSpeakers} opacity={0.3} />
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Events
      </Link>

      {event.imageUrl && (
        <div className="aspect-video rounded-2xl overflow-hidden bg-surface-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.imageUrl} className="w-full h-full object-cover" alt="" />
        </div>
      )}

      <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full text-muted">{CATEGORY_LABELS[event.category] ?? event.category}</span>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-3 mb-3">{event.title}</h1>

      <div className="flex flex-wrap gap-4 text-sm text-muted mb-5">
        <span className="flex items-center gap-1.5">
          <Calendar size={14} /> {event.startsAt ? formatDate(event.startsAt) : "Date TBD"}
        </span>
        <span className="flex items-center gap-1.5">
          {event.format === "virtual" ? <Video size={14} /> : <MapPin size={14} />}
          {event.location || (event.format === "virtual" ? "Virtual" : "Location TBD")}
        </span>
        {event.churchName && (
          <span className="flex items-center gap-1.5">
            <Users2 size={14} /> {event.churchName}
          </span>
        )}
      </div>

      {event.description && <p className="text-sm text-muted leading-relaxed mb-6">{event.description}</p>}

      {event.requiresPayment && (
        <div className="qk-card p-4 text-sm text-muted mb-6">
          This event has an associated cost. Contact Quest for the Kingdom for pricing and registration details.
        </div>
      )}
    </div>
  );
}
