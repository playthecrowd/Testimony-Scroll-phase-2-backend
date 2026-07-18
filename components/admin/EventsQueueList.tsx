"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PublishedEvent, EventStatus } from "@/types";
import { updateEventStatusAction, updateEventFeaturedAction } from "@/app/admin/events/actions";

const STATUS_LABELS: Record<EventStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  published: "Published",
  declined: "Declined",
};

export function EventsQueueList({ events: initial }: { events: PublishedEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(id: string, status: EventStatus) {
    setPendingId(id);
    setError("");
    const result = await updateEventStatusAction(id, status);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (status === "published") {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } else {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    }
  }

  async function toggleFeatured(id: string, featured: boolean) {
    setPendingId(id);
    setError("");
    const result = await updateEventFeaturedAction(id, featured);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, featured } : e)));
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted">No event requests waiting right now.</p>;
  }

  return (
    <div className="space-y-2.5">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {events.map((ev) => {
        const busy = pendingId === ev.id;
        return (
          <div key={ev.id} className="qk-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {ev.requestingOrg || ev.churchName || "Independent request"} · {ev.category.replace(/_/g, " ")} ·{" "}
                  {formatDate(ev.createdAt)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] bg-surface-2 text-muted px-2 py-0.5 rounded-full">{STATUS_LABELS[ev.status]}</span>
            </div>
            {ev.description && <p className="text-xs text-muted mt-2 line-clamp-2">{ev.description}</p>}
            {ev.requiresPayment && <p className="text-[11px] text-accent-gold mt-1">Requires payment -- coordinate pricing manually.</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {ev.status === "submitted" && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(ev.id, "under_review")}>
                  Mark Under Review
                </Button>
              )}
              {(ev.status === "submitted" || ev.status === "under_review") && (
                <Button size="sm" disabled={busy} onClick={() => setStatus(ev.id, "approved")}>
                  Approve
                </Button>
              )}
              {ev.status === "approved" && (
                <Button size="sm" disabled={busy} onClick={() => setStatus(ev.id, "published")}>
                  Publish to Calendar
                </Button>
              )}
              {ev.status !== "declined" && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(ev.id, "declined")}>
                  Decline
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggleFeatured(ev.id, !ev.featured)}>
                {ev.featured ? "Unfeature" : "Feature"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
