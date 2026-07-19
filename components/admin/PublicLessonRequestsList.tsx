"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { LessonRequestStatusBadge } from "@/components/lessonRequests/LessonRequestStatusBadge";
import { LessonRequest, LessonRequestStatus } from "@/types";
import { updatePublicLessonRequestStatusAction } from "@/app/admin/lesson-requests/actions";

export function PublicLessonRequestsList({ requests: initialRequests }: { requests: LessonRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(requestId: string, status: LessonRequestStatus) {
    setPendingId(requestId);
    setError("");
    const result = await updatePublicLessonRequestStatusAction(requestId, status);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted">No public lesson requests awaiting review.</p>;
  }

  return (
    <div className="space-y-2.5">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {requests.map((r) => {
        const busy = pendingId === r.id;
        return (
          <div key={r.id} className="qk-card p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground truncate">{r.topic}</p>
                <LessonRequestStatusBadge status={r.status} />
              </div>
              {r.notes && <p className="text-xs text-muted mt-0.5 line-clamp-2">{r.notes}</p>}
              <p className="text-[11px] text-muted mt-0.5">Requested {formatDate(r.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {r.status === "submitted" && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(r.id, "under_review")}>
                  Mark Under Review
                </Button>
              )}
              <Button size="sm" disabled={busy} onClick={() => setStatus(r.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(r.id, "declined")}>
                Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
