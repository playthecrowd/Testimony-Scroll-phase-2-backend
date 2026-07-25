"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ChurchExperienceOccurrence } from "@/types";
import { getCommonTimezoneOptions } from "@/lib/experienceTimezone";
import { createOccurrenceAction, updateOccurrenceAction } from "@/app/host-dashboard/experiences/actions";

// Datetime-local inputs give/expect a "YYYY-MM-DDTHH:mm" string with no timezone info of their
// own -- the separate timezone select below is what actually says how to interpret it. Converted
// to a real ISO instant at submit time using that selected zone.
function toIsoInSelectedTimezone(localValue: string): string {
  // Intl doesn't offer a clean "parse this wall-clock time as if it were in zone X" primitive, so
  // this deliberately keeps the same simplification the rest of the app already uses for
  // date-only fields (lessons.date): submit the local value as given by the browser and let the
  // browser's own local interpretation produce the instant, with the explicit timezone field
  // stored alongside purely for correct *display* later (spec SS9's occurrence.timezone is the
  // source of truth for display, not for reinterpreting this input).
  return new Date(localValue).toISOString();
}

export function OccurrenceForm({
  experienceId,
  defaultTimezone,
  occurrence,
}: {
  experienceId: string;
  defaultTimezone: string | null;
  occurrence?: ChurchExperienceOccurrence;
}) {
  const router = useRouter();
  const isEdit = !!occurrence;

  const [startsAt, setStartsAt] = useState(occurrence ? occurrence.startsAt.slice(0, 16) : "");
  const [endsAt, setEndsAt] = useState(occurrence?.endsAt ? occurrence.endsAt.slice(0, 16) : "");
  const [timezone, setTimezone] = useState(occurrence?.timezone ?? defaultTimezone ?? "America/Chicago");
  const [registrationOpensAt, setRegistrationOpensAt] = useState(occurrence?.registrationOpensAt?.slice(0, 16) ?? "");
  const [registrationClosesAt, setRegistrationClosesAt] = useState(occurrence?.registrationClosesAt?.slice(0, 16) ?? "");
  const [capacity, setCapacity] = useState(occurrence?.capacity?.toString() ?? "");
  const [locationName, setLocationName] = useState(occurrence?.locationName ?? "");
  const [onlineUrl, setOnlineUrl] = useState(occurrence?.onlineUrl ?? "");
  const [hostContactName, setHostContactName] = useState(occurrence?.hostContactName ?? "");
  const [hostContactEmail, setHostContactEmail] = useState(occurrence?.hostContactEmail ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    const payload = {
      startsAt: toIsoInSelectedTimezone(startsAt),
      endsAt: endsAt ? toIsoInSelectedTimezone(endsAt) : null,
      timezone,
      registrationOpensAt: registrationOpensAt ? toIsoInSelectedTimezone(registrationOpensAt) : null,
      registrationClosesAt: registrationClosesAt ? toIsoInSelectedTimezone(registrationClosesAt) : null,
      capacity: capacity.trim() ? Number(capacity) : null,
      locationName: locationName || null,
      onlineUrl: onlineUrl || null,
      hostContactName: hostContactName || null,
      hostContactEmail: hostContactEmail || null,
    };

    const result = isEdit
      ? await updateOccurrenceAction({ occurrenceId: occurrence!.id, ...payload })
      : await createOccurrenceAction({ experienceId, ...payload });

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    const occurrenceId = isEdit ? occurrence!.id : result.data?.id;
    if (occurrenceId) router.push(`/host-dashboard/experiences/${experienceId}/occurrences/${occurrenceId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 md:p-6 space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Starts At" required>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="qk-input" />
        </Field>
        <Field label="Ends At">
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Timezone" required>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="qk-input">
          {getCommonTimezoneOptions().map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="block text-[11px] text-muted mt-1">
          Dates are always shown in this occurrence&apos;s own timezone to every viewer, regardless of their location.
        </span>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Registration Opens">
          <input type="datetime-local" value={registrationOpensAt} onChange={(e) => setRegistrationOpensAt(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Registration Closes">
          <input type="datetime-local" value={registrationClosesAt} onChange={(e) => setRegistrationClosesAt(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Capacity (blank = unlimited, overrides the Experience's default)">
        <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="qk-input" />
      </Field>

      <Field label="Location Override">
        <input value={locationName} onChange={(e) => setLocationName(e.target.value)} className="qk-input" placeholder="Leave blank to use the Experience's default" />
      </Field>
      <Field label="Meeting Link Override">
        <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} className="qk-input" placeholder="Leave blank to use the Experience's default" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Host Contact Name">
          <input value={hostContactName} onChange={(e) => setHostContactName(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Host Contact Email">
          <input type="email" value={hostContactEmail} onChange={(e) => setHostContactEmail(e.target.value)} className="qk-input" />
        </Field>
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : isEdit ? "Save Changes" : "Schedule Occurrence"}
      </Button>
    </form>
  );
}
