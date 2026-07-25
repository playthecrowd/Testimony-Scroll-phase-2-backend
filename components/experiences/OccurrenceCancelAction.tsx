"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cancelOccurrenceAction, finalizeOccurrenceAttendanceAction } from "@/app/host-dashboard/experiences/actions";

export function OccurrenceCancelAction({ occurrenceId, status }: { occurrenceId: string; status: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    const reason = window.prompt("Cancellation reason (visible to your church's admins):", "");
    if (reason === null) return; // user dismissed the prompt
    const confirmed = window.confirm("Cancel this occurrence? Existing registrations are kept for history, not deleted.");
    if (!confirmed) return;
    setSubmitting(true);
    setError("");
    const result = await cancelOccurrenceAction(occurrenceId, reason);
    setSubmitting(false);
    if (result.error) return setError(result.error);
    router.refresh();
  }

  async function handleFinalize() {
    setSubmitting(true);
    setError("");
    const result = await finalizeOccurrenceAttendanceAction(occurrenceId);
    setSubmitting(false);
    if (result.error) return setError(result.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "scheduled" && (
          <>
            <Button size="sm" variant="secondary" onClick={handleFinalize} disabled={submitting}>
              Finalize Attendance
            </Button>
            <Button size="sm" variant="secondary" onClick={handleCancel} disabled={submitting}>
              Cancel Occurrence
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
    </div>
  );
}
