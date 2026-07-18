"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChurchExperienceAttendanceStatus, ChurchExperienceCompletionStatus } from "@/types";
import { ChurchExperienceRegistrationWithProfile } from "@/services/supabase/churchExperiences";
import {
  updateRegistrationStatusAction,
  updateAttendanceStatusAction,
  updateCompletionStatusAction,
  promoteWaitlistRegistrationAction,
} from "@/app/host-dashboard/experiences/actions";

const ATTENDANCE_LABELS: Record<ChurchExperienceAttendanceStatus, string> = {
  not_recorded: "Not recorded",
  attended: "Attended",
  absent: "Absent",
  excused: "Excused",
};

const COMPLETION_LABELS: Record<ChurchExperienceCompletionStatus, string> = {
  not_started: "Not started",
  completed: "Completed",
};

// Host-facing registrant management for one occurrence (Phase 10.3, checkpoints 3/6/7/8).
// Registration, attendance, and completion are always three independent controls -- never
// coupled here; whether completion follows attendance automatically is left entirely to the
// host's own judgment per registrant, matching the Experience's completion_method being a
// separate, host-authored decision (spec SS7/E), not something this UI infers silently.
export function RegistrationsList({
  occurrenceId,
  registrations: initial,
  occurrenceCancelled,
}: {
  occurrenceId: string;
  registrations: ChurchExperienceRegistrationWithProfile[];
  occurrenceCancelled: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function patch(registrationId: string, changes: Partial<ChurchExperienceRegistrationWithProfile["registration"]>) {
    setItems((prev) => prev.map((it) => (it.registration.id === registrationId ? { ...it, registration: { ...it.registration, ...changes } } : it)));
  }

  async function handleApprove(registrationId: string) {
    setPendingId(registrationId);
    setError("");
    const result = await updateRegistrationStatusAction(registrationId, "confirmed");
    setPendingId(null);
    if (result.error) return setError(result.error);
    patch(registrationId, { status: "confirmed" });
  }

  async function handleReject(registrationId: string) {
    setPendingId(registrationId);
    setError("");
    const result = await updateRegistrationStatusAction(registrationId, "rejected");
    setPendingId(null);
    if (result.error) return setError(result.error);
    patch(registrationId, { status: "rejected" });
  }

  async function handleAttendance(registrationId: string, status: ChurchExperienceAttendanceStatus) {
    setPendingId(registrationId);
    setError("");
    const result = await updateAttendanceStatusAction(registrationId, status);
    setPendingId(null);
    if (result.error) return setError(result.error);
    patch(registrationId, { attendanceStatus: status });
  }

  async function handleCompletion(registrationId: string, status: ChurchExperienceCompletionStatus) {
    setPendingId(registrationId);
    setError("");
    const result = await updateCompletionStatusAction(registrationId, status);
    setPendingId(null);
    if (result.error) return setError(result.error);
    patch(registrationId, { completionStatus: status });
  }

  async function handlePromote() {
    setPendingId("__promote__");
    setError("");
    const result = await promoteWaitlistRegistrationAction(occurrenceId);
    setPendingId(null);
    if (result.error) return setError(result.error);
    if (!result.data?.promoted) {
      setError("No one was promoted -- either the waitlist is empty or there's no room.");
      return;
    }
    // Simplest correct refresh here is a full reload of this list's data from the server, since
    // promotion changes a different row than the one acted on; the parent page's revalidatePath
    // handles that on next navigation, but for immediate feedback within this client component we
    // just mark the earliest waitlisted row optimistically -- Next's router.refresh() (triggered
    // by the server action's revalidatePath) will reconcile the authoritative state shortly after.
    const waitlisted = [...items].filter((it) => it.registration.status === "waitlisted").sort((a, b) => (a.registration.waitlistPosition ?? 0) - (b.registration.waitlistPosition ?? 0));
    if (waitlisted[0]) patch(waitlisted[0].registration.id, { status: "confirmed", waitlistPosition: null });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">No registrations yet.</p>;
  }

  const hasWaitlist = items.some((it) => it.registration.status === "waitlisted");

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </p>
      )}
      {hasWaitlist && !occurrenceCancelled && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={handlePromote} disabled={pendingId === "__promote__"}>
            {pendingId === "__promote__" ? "Promoting..." : "Promote Next from Waitlist"}
          </Button>
        </div>
      )}
      <div className="space-y-1.5">
        {items.map(({ registration: r, profile }) => {
          const busy = pendingId === r.id;
          return (
            <div key={r.id} className="qk-card p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{profile.fullName || profile.email}</p>
                <p className="text-[11px] text-muted">
                  {r.status}
                  {r.status === "waitlisted" && r.waitlistPosition ? ` #${r.waitlistPosition}` : ""}
                  {r.registrationSource === "host_walk_in" ? " · Walk-in" : ""}
                  {r.capacityOverride ? " · Over-capacity override" : ""}
                </p>
              </div>

              {r.status === "pending" && !occurrenceCancelled && (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => handleApprove(r.id)} disabled={busy}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleReject(r.id)} disabled={busy}>
                    Reject
                  </Button>
                </div>
              )}

              <label className="text-[11px] text-muted flex items-center gap-1.5">
                Attendance
                <select
                  value={r.attendanceStatus}
                  onChange={(e) => handleAttendance(r.id, e.target.value as ChurchExperienceAttendanceStatus)}
                  disabled={busy || occurrenceCancelled}
                  className="qk-input w-auto text-[11px] py-1"
                >
                  {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] text-muted flex items-center gap-1.5">
                Completion
                <select
                  value={r.completionStatus}
                  onChange={(e) => handleCompletion(r.id, e.target.value as ChurchExperienceCompletionStatus)}
                  disabled={busy || occurrenceCancelled}
                  className="qk-input w-auto text-[11px] py-1"
                >
                  {Object.entries(COMPLETION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
