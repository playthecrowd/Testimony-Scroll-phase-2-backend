"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PublishedTestimony, TestimonyPlatformStatus } from "@/types";
import { updatePlatformTestimonyStatusAction } from "@/app/admin/testimonies/actions";

export function PublicTestimoniesList({ testimonies: initial }: { testimonies: PublishedTestimony[] }) {
  const [testimonies, setTestimonies] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(testimonyId: string, status: TestimonyPlatformStatus) {
    setPendingId(testimonyId);
    setError("");
    const result = await updatePlatformTestimonyStatusAction(testimonyId, status);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTestimonies((prev) => prev.filter((t) => t.id !== testimonyId));
  }

  if (testimonies.length === 0) {
    return <p className="text-sm text-muted">No public testimonies awaiting review.</p>;
  }

  return (
    <div className="space-y-2.5">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {testimonies.map((t) => {
        const busy = pendingId === t.id;
        return (
          <div key={t.id} className="qk-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {t.churchName || "A church"} · {t.primaryLessonTitle ? `About "${t.primaryLessonTitle}"` : ""} · {formatDate(t.createdAt)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] bg-accent-blue/15 text-accent-blue-light px-2 py-0.5 rounded-full">Church-approved</span>
            </div>
            <p className="text-xs text-muted mt-2 line-clamp-3">{t.writtenTestimony}</p>
            {t.suggestedCharacter && <p className="text-[11px] text-muted mt-1">Suggested character: {t.suggestedCharacter}</p>}
            <div className="flex gap-2 mt-3">
              <Button size="sm" disabled={busy} onClick={() => setStatus(t.id, "approved")}>
                Approve for Kingdom Scroll
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(t.id, "rejected")}>
                Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
