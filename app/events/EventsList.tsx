"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Video } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { PublishedEvent, EventCategory } from "@/types";

const CATEGORY_LABELS: Record<EventCategory, string> = {
  pop_up_virtual: "Pop-up Virtual",
  pop_up_physical: "Pop-up Physical",
  ticketed: "Ticketed",
  game_day: "Game Day",
  church_hosted: "Church-Hosted",
  kingdom_scroll: "Kingdom Scroll",
};

function monthLabel(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// "Calendar presentation" (Part 18) as a grouped-by-month, chronologically sorted list rather
// than a full interactive month-grid widget -- see docs/PHASE8_AUDIT.md for why that trim was made.
export function EventsList({ events }: { events: PublishedEvent[] }) {
  const [category, setCategory] = useState<EventCategory | "all">("all");

  const filtered = useMemo(() => (category === "all" ? events : events.filter((e) => e.category === category)), [events, category]);

  const groups = useMemo(() => {
    const map = new Map<string, PublishedEvent[]>();
    for (const ev of filtered) {
      const key = monthLabel(ev.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          onClick={() => setCategory("all")}
          className={cn("text-xs px-3 py-1.5 rounded-full", category === "all" ? "bg-accent-blue text-white" : "bg-surface-2 text-muted hover:text-foreground")}
        >
          All Categories
        </button>
        {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn("text-xs px-3 py-1.5 rounded-full", category === c ? "bg-accent-blue text-white" : "bg-surface-2 text-muted hover:text-foreground")}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No events match right now.</div>
      ) : (
        <div className="space-y-6">
          {groups.map(([month, monthEvents]) => (
            <div key={month}>
              <p className="text-xs font-semibold text-muted mb-2.5">{month}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthEvents.map((ev) => (
                  <Link key={ev.id} href={`/events/${ev.id}`} className="qk-card overflow-hidden group block">
                    <div className="relative aspect-video bg-surface-2">
                      {ev.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ev.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                      )}
                      <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{CATEGORY_LABELS[ev.category]}</span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                      <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5">
                        {ev.format === "virtual" ? <Video size={11} /> : <MapPin size={11} />}
                        {ev.startsAt ? formatDate(ev.startsAt) : "Date TBD"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
