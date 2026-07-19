"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { EventCategory, EventFormat, PublishedChurch } from "@/types";
import { submitEventRequestAction } from "./actions";

const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: "pop_up_virtual", label: "Pop-up Virtual Event" },
  { value: "pop_up_physical", label: "Pop-up Physical Event" },
  { value: "ticketed", label: "Ticketed Scheduled Event" },
  { value: "game_day", label: "Game Day" },
  { value: "church_hosted", label: "Church-Hosted Event" },
  { value: "kingdom_scroll", label: "Kingdom Scroll Event" },
];

export function HostEventForm({ myChurches }: { myChurches: PublishedChurch[] }) {
  const [churchId, setChurchId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("church_hosted");
  const [format, setFormat] = useState<EventFormat>("physical");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [requestingOrg, setRequestingOrg] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [expectedAttendance, setExpectedAttendance] = useState("");
  const [requestedExperience, setRequestedExperience] = useState("");
  const [equipmentNotes, setEquipmentNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await submitEventRequestAction({
      churchId: churchId || null,
      title,
      description,
      category,
      format,
      location,
      startsAt,
      endsAt,
      requestingOrg,
      contactName,
      contactEmail,
      expectedAttendance,
      requestedExperience,
      equipmentNotes,
      notes,
      requiresPayment,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="qk-card p-10 text-center">
        <p className="text-foreground font-semibold mb-2">Event request submitted.</p>
        <p className="text-sm text-muted">
          Quest for the Kingdom will review your request, confirm any pricing or requirements, and let you know once
          it&apos;s approved and on the calendar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
      {myChurches.length > 0 && (
        <Field label="Which church is this for? (optional)">
          <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="qk-input">
            <option value="">Not tied to a specific church</option>
            {myChurches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Requesting Church or Organization">
        <input value={requestingOrg} onChange={(e) => setRequestingOrg(e.target.value)} className="qk-input" />
      </Field>

      <Field label="Event Title" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="qk-input" />
      </Field>

      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="qk-input resize-none" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Event Type" required>
          <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} className="qk-input">
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format" required>
          <select value={format} onChange={(e) => setFormat(e.target.value as EventFormat)} className="qk-input">
            <option value="physical">Physical / In-person</option>
            <option value="virtual">Virtual</option>
          </select>
        </Field>
      </div>

      <Field label="Location (address, or virtual link/platform)">
        <input value={location} onChange={(e) => setLocation(e.target.value)} className="qk-input" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Preferred Start">
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Preferred End">
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contact Name">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Contact Email" required>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Expected Attendance">
        <input type="number" min={0} value={expectedAttendance} onChange={(e) => setExpectedAttendance(e.target.value)} className="qk-input" />
      </Field>

      <Field label="Requested Experience">
        <input
          value={requestedExperience}
          onChange={(e) => setRequestedExperience(e.target.value)}
          placeholder="A Quest for the Kingdom experience you'd like featured, if any"
          className="qk-input"
        />
      </Field>

      <Field label="Equipment / Production Needs">
        <textarea value={equipmentNotes} onChange={(e) => setEquipmentNotes(e.target.value)} rows={2} className="qk-input resize-none" />
      </Field>

      <Field label="Additional Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="qk-input resize-none" />
      </Field>

      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" checked={requiresPayment} onChange={(e) => setRequiresPayment(e.target.checked)} className="mt-0.5" />
        This event may involve a cost (ticketing, production fee, etc.) -- Quest for the Kingdom will follow up on
        pricing and payment directly if so.
      </label>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" disabled={submitting}>
        <Send size={16} /> {submitting ? "Submitting..." : "Submit Event Request"}
      </Button>
    </form>
  );
}
