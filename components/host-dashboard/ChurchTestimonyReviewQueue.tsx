"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PublishedTestimony, TestimonyChurchStatus } from "@/types";
import { updateChurchTestimonyStatusAction } from "@/app/host-dashboard/testimonies/actions";

export function ChurchTestimonyReviewQueue({ churchId, testimonies: initial }: { churchId: string; testimonies: PublishedTestimony[] }) {
  const [testimonies, setTestimonies] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(testimonyId: string, status: TestimonyChurchStatus) {
    setPendingId(testimonyId);
    setError("");
    const result = await updateChurchTestimonyStatusAction(testimonyId, churchId, status);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTestimonies((prev) => prev.map((t) => (t.id === testimonyId ? { ...t, churchStatus: status } : t)));
  }

  const pending = testimonies.filter((t) => t.churchStatus === "pending");

  if (pending.length === 0) {
    return <p className="text-sm text-muted">No testimonies awaiting review.</p>;
  }

  return (
    <div className="space-y-2.5">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {pending.map((t) => {
        const busy = pendingId === t.id;
        return (
          <div key={t.id} className="qk-card p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {t.primaryLessonTitle ? `About "${t.primaryLessonTitle}"` : ""} · {formatDate(t.createdAt)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] bg-surface-2 text-muted px-2 py-0.5 rounded-full capitalize">{t.visibility.replace("_", " ")}</span>
            </div>
            <p className="text-xs text-muted mt-2 line-clamp-3">{t.writtenTestimony}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" disabled={busy} onClick={() => setStatus(t.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(t.id, "rejected")}>
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
