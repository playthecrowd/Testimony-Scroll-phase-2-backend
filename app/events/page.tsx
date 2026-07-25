import Link from "next/link";
import { CalendarHeart, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { PageBackground } from "@/components/layout/PageBackground";
import { backgrounds } from "@/data/backgrounds";
import { getPublishedEvents } from "@/services/supabase/events";
import { EventsList } from "./EventsList";

export const dynamic = "force-dynamic";

// Real, Supabase-backed as of Phase 8 (docs/PHASE8_AUDIT.md) -- previously one hardcoded event
// linking to a static HTML file. The homepage's FeaturedEventBanner is deliberately NOT touched
// here -- the rest of the homepage (lessons, testimonies) is still mock too, so making just the
// event banner real would show real content next to mock content on the same page; left
// consistent (all mock) until the homepage itself is migrated.
export default async function EventsPage() {
  let events: Awaited<ReturnType<typeof getPublishedEvents>> = [];
  let loadError = "";
  try {
    // createClient() itself throws SupabaseConfigError when env vars are missing -- it must stay
    // inside this try so that failure renders the graceful branded error state below.
    const supabase = await createClient();
    events = await getPublishedEvents(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    console.error("[EventsPage] Failed to load events:", err);
    loadError = "We couldn't load events right now. Please try again shortly.";
  }

  const featured = events.find((e) => e.featured) ?? null;
  const rest = featured ? events.filter((e) => e.id !== featured.id) : events;

  return (
    <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <PageBackground src={backgrounds.featuredSpeakers} opacity={0.45} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarHeart size={26} className="text-accent-gold" /> Events
          </h1>
          <p className="text-muted text-sm mt-1">Kingdom-wide campaigns and events happening across the network.</p>
        </div>
        <LinkButton href="/events/host" size="sm">
          Host an Event
        </LinkButton>
      </div>

      {loadError ? (
        <div className="mt-6">
          <ErrorState message={loadError} />
        </div>
      ) : (
        <>
          {featured && (
            <Link
              href={`/events/${featured.id}`}
              className="relative block rounded-2xl overflow-hidden group border border-accent-gold/40 qk-glow-gold my-8"
            >
              <div className="absolute inset-0">
                {featured.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featured.imageUrl} alt="" className="w-full h-full object-cover opacity-45 group-hover:scale-105 transition-transform duration-300" />
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(6,10,20,0.55) 0%, rgba(6,10,20,0.92) 80%, rgba(6,10,20,1) 100%)" }}
                />
              </div>
              <div className="relative px-6 py-10 md:px-10 md:py-14 text-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-gold bg-accent-gold/10 border border-accent-gold/40 px-2.5 py-1 rounded-full mb-4">
                  <Sparkles size={12} /> Featured Kingdom Event
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-3">{featured.title}</h2>
                {featured.description && <p className="text-sm md:text-base text-muted max-w-xl mx-auto mb-6">{featured.description}</p>}
                <span className="inline-flex items-center justify-center gap-1.5 bg-accent-gold hover:brightness-110 text-[#231607] text-sm font-semibold px-6 py-3.5 rounded-lg">
                  Learn More <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          )}

          <div className="mt-6">
            <EventsList events={rest} />
          </div>
        </>
      )}
    </div>
  );
}
