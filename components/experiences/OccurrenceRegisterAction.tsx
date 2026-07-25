"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChurchExperienceRegistration } from "@/types";
import { registerForExperienceOccurrenceAction, cancelMyRegistrationAction } from "@/app/experiences/actions";

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: "You're confirmed for this occurrence.",
  pending: "Your registration is awaiting host approval.",
  waitlisted: "You're on the waitlist -- you'll be confirmed automatically if a spot opens up.",
  rejected: "Your registration request was not approved.",
};

// Member-facing register/cancel for one occurrence (Phase 10.3, checkpoint 5/6). Both mutations go
// through the Phase 10.1 RPCs exclusively (app/experiences/actions.ts) -- never a direct client
// insert/update into church_experience_registrations.
export function OccurrenceRegisterAction({
  occurrenceId,
  occurrenceStatus,
  initialRegistration,
}: {
  occurrenceId: string;
  occurrenceStatus: string;
  initialRegistration: ChurchExperienceRegistration | null;
}) {
  const router = useRouter();
  const [registration, setRegistration] = useState(initialRegistration);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    setSubmitting(true);
    setError("");
    const result = await registerForExperienceOccurrenceAction(occurrenceId);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.registration) setRegistration(result.registration);
    router.refresh();
  }

  async function handleCancel() {
    if (!registration) return;
    const confirmed = window.confirm("Cancel your registration for this occurrence?");
    if (!confirmed) return;
    setSubmitting(true);
    setError("");
    const result = await cancelMyRegistrationAction(registration.id);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRegistration(null);
    router.refresh();
  }

  if (occurrenceStatus !== "scheduled") {
    return <p className="text-xs text-muted">This occurrence is {occurrenceStatus} and is not open for registration.</p>;
  }

  return (
    <div>
      {registration ? (
        <div className="space-y-2">
          <p className="text-xs text-accent-blue-light">{STATUS_MESSAGES[registration.status] ?? registration.status}</p>
          {(registration.status === "confirmed" || registration.status === "pending" || registration.status === "waitlisted") && (
            <Button size="sm" variant="secondary" onClick={handleCancel} disabled={submitting}>
              {submitting ? "Cancelling..." : "Cancel Registration"}
            </Button>
          )}
        </div>
      ) : (
        <Button size="sm" onClick={handleRegister} disabled={submitting}>
          {submitting ? "Registering..." : "Register"}
        </Button>
      )}
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
    </div>
  );
}
