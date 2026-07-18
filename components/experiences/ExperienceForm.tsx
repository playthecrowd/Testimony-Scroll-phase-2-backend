"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ChurchExperience, ChurchMinistry } from "@/types";
import { EXPERIENCE_TYPE_LABELS, EXPERIENCE_FORMAT_LABELS } from "@/components/experiences/ExperienceStatusBadge";
import { createExperienceAction, updateExperienceAction } from "@/app/host-dashboard/experiences/actions";

// Shared between create (/host-dashboard/experiences/new) and edit
// (/host-dashboard/experiences/[experienceId]/edit) -- same field set either way, following
// ChurchProfileForm's established shape (client component owns local state, calls a server action,
// shows inline + top-level error/success feedback, disables the submit button while in flight to
// prevent a duplicate submit).
export function ExperienceForm({ churchId, ministries, experience }: { churchId: string; ministries: ChurchMinistry[]; experience?: ChurchExperience }) {
  const router = useRouter();
  const isEdit = !!experience;

  const [title, setTitle] = useState(experience?.title ?? "");
  const [summary, setSummary] = useState(experience?.summary ?? "");
  const [fullDescription, setFullDescription] = useState(experience?.fullDescription ?? "");
  const [type, setType] = useState(experience?.type ?? "volunteer");
  const [customTypeLabel, setCustomTypeLabel] = useState(experience?.customTypeLabel ?? "");
  const [format, setFormat] = useState(experience?.format ?? "in_person");
  const [ministryId, setMinistryId] = useState(experience?.ministryId ?? "");
  const [locationName, setLocationName] = useState(experience?.locationName ?? "");
  const [addressLine1, setAddressLine1] = useState(experience?.addressLine1 ?? "");
  const [city, setCity] = useState(experience?.city ?? "");
  const [region, setRegion] = useState(experience?.region ?? "");
  const [country, setCountry] = useState(experience?.country ?? "");
  const [onlineUrl, setOnlineUrl] = useState(experience?.onlineUrl ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(experience?.coverImageUrl ?? "");
  const [ageGuidance, setAgeGuidance] = useState(experience?.ageGuidance ?? "");
  const [accessibilityNotes, setAccessibilityNotes] = useState(experience?.accessibilityNotes ?? "");
  const [preparationInstructions, setPreparationInstructions] = useState(experience?.preparationInstructions ?? "");
  const [whatToBring, setWhatToBring] = useState(experience?.whatToBring ?? "");
  const [visibility, setVisibility] = useState(experience?.visibility ?? "church_only");
  const [registrationRequired, setRegistrationRequired] = useState(experience?.registrationRequired ?? true);
  const [approvalRequired, setApprovalRequired] = useState(experience?.approvalRequired ?? false);
  const [defaultCapacity, setDefaultCapacity] = useState(experience?.defaultCapacity?.toString() ?? "");
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(experience?.defaultDurationMinutes?.toString() ?? "");
  const [completionMethod, setCompletionMethod] = useState(experience?.completionMethod ?? "host_marked");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // duplicate-submit protection
    setError("");
    setSubmitting(true);

    const capacityValue = defaultCapacity.trim() ? Number(defaultCapacity) : null;
    const durationValue = defaultDurationMinutes.trim() ? Number(defaultDurationMinutes) : null;

    const payload = {
      churchId,
      title,
      summary,
      fullDescription,
      type,
      customTypeLabel,
      format,
      ministryId: ministryId || null,
      locationName,
      addressLine1,
      city,
      region,
      country,
      onlineUrl,
      coverImageUrl,
      ageGuidance,
      accessibilityNotes,
      preparationInstructions,
      whatToBring,
      visibility,
      registrationRequired,
      approvalRequired,
      defaultCapacity: capacityValue,
      defaultDurationMinutes: durationValue,
      completionMethod,
    };

    const result = isEdit
      ? await updateExperienceAction({ experienceId: experience!.id, ...payload })
      : await createExperienceAction(payload);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    if (isEdit) {
      router.push(`/host-dashboard/experiences/${experience!.id}`);
    } else if (result.data) {
      router.push(`/host-dashboard/experiences/${result.data.id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 md:p-6 space-y-4 max-w-2xl">
      <Field label="Title" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="qk-input" />
      </Field>

      <Field label="Summary">
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="A short one- or two-line summary." className="qk-input" />
      </Field>

      <Field label="Full Description">
        <textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} rows={4} className="qk-input" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Type" required>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="qk-input">
            {Object.entries(EXPERIENCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format" required>
          <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="qk-input">
            {Object.entries(EXPERIENCE_FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {type === "custom" && (
        <Field label="Custom Type Label" required>
          <input value={customTypeLabel} onChange={(e) => setCustomTypeLabel(e.target.value)} className="qk-input" placeholder="e.g., Youth Lock-In" />
        </Field>
      )}

      <Field label="Ministry (optional)">
        <select value={ministryId} onChange={(e) => setMinistryId(e.target.value)} className="qk-input">
          <option value="">No ministry</option>
          {ministries.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      {(format === "in_person" || format === "hybrid") && (
        <>
          <Field label="Default Location Name">
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} className="qk-input" placeholder="e.g., Fellowship Hall" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Street Address">
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="qk-input" />
            </Field>
            <Field label="City">
              <input value={city} onChange={(e) => setCity(e.target.value)} className="qk-input" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Region / State">
              <input value={region} onChange={(e) => setRegion(e.target.value)} className="qk-input" />
            </Field>
            <Field label="Country">
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="qk-input" />
            </Field>
          </div>
        </>
      )}

      {(format === "online" || format === "hybrid") && (
        <Field label="Default Meeting Link">
          <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://..." className="qk-input" />
        </Field>
      )}

      <Field label="Cover Image URL">
        <input type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." className="qk-input" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Age Guidance">
          <input value={ageGuidance} onChange={(e) => setAgeGuidance(e.target.value)} className="qk-input" placeholder="e.g., All ages welcome" />
        </Field>
        <Field label="Accessibility Notes">
          <input value={accessibilityNotes} onChange={(e) => setAccessibilityNotes(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <Field label="Preparation Instructions">
        <textarea value={preparationInstructions} onChange={(e) => setPreparationInstructions(e.target.value)} rows={2} className="qk-input" />
      </Field>
      <Field label="What to Bring">
        <textarea value={whatToBring} onChange={(e) => setWhatToBring(e.target.value)} rows={2} className="qk-input" />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Visibility" required>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="qk-input">
            <option value="church_only">Church Only</option>
            <option value="invited_only">Invited Only</option>
          </select>
        </Field>
        <Field label="Completion Method" required>
          <select value={completionMethod} onChange={(e) => setCompletionMethod(e.target.value as typeof completionMethod)} className="qk-input">
            <option value="host_marked">Host Marks Completion</option>
            <option value="self_attested">Member Self-Attests Completion</option>
          </select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Default Capacity (blank = unlimited)">
          <input type="number" min={1} value={defaultCapacity} onChange={(e) => setDefaultCapacity(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Default Duration (minutes)">
          <input type="number" min={1} value={defaultDurationMinutes} onChange={(e) => setDefaultDurationMinutes(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={registrationRequired} onChange={(e) => setRegistrationRequired(e.target.checked)} />
          Registration required
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} />
          Host approval required
        </label>
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Experience (Draft)"}
        </Button>
      </div>
    </form>
  );
}
