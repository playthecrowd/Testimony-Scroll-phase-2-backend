"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { PublishedChurch, ChurchMinistry } from "@/types";
import { updateChurchProfileAction } from "./actions";

export function ChurchProfileForm({ church, ministries }: { church: PublishedChurch; ministries: ChurchMinistry[] }) {
  const router = useRouter();
  const [name, setName] = useState(church.name);
  const [description, setDescription] = useState(church.description ?? "");
  const [city, setCity] = useState(church.city ?? "");
  const [region, setRegion] = useState(church.region ?? "");
  const [country, setCountry] = useState(church.country ?? "");
  const [addressLine1, setAddressLine1] = useState(church.addressLine1 ?? "");
  const [website, setWebsite] = useState(church.website ?? "");
  const [contactEmail, setContactEmail] = useState(church.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(church.contactPhone ?? "");
  const [churchType, setChurchType] = useState(church.churchType ?? "");
  const [logoUrl, setLogoUrl] = useState(church.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(church.bannerUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSubmitting(true);
    const result = await updateChurchProfileAction({
      churchId: church.id,
      churchSlug: church.slug,
      name,
      description,
      city,
      region,
      country,
      addressLine1,
      website,
      contactEmail,
      contactPhone,
      churchType,
      logoUrl,
      bannerUrl,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="qk-card p-5 md:p-6 space-y-4 max-w-2xl">
      <Field label="Church Name" required>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="qk-input" />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What visitors and members should know about your church."
          className="qk-input"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Church Type / Tradition">
          <input
            list="church-type-suggestions"
            value={churchType}
            onChange={(e) => setChurchType(e.target.value)}
            placeholder="e.g., Non-denominational, Baptist"
            className="qk-input"
          />
          <datalist id="church-type-suggestions">
            <option value="Non-denominational" />
            <option value="Baptist" />
            <option value="Methodist" />
            <option value="Pentecostal" />
            <option value="Catholic" />
            <option value="Presbyterian" />
            <option value="Lutheran" />
            <option value="Evangelical" />
          </datalist>
        </Field>
        <Field label="Website">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourchurch.org"
            className="qk-input"
          />
        </Field>
      </div>

      <Field label="Street Address">
        <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="qk-input" />
      </Field>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Region / State">
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Country">
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contact Email">
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="qk-input" />
        </Field>
        <Field label="Contact Phone">
          <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="qk-input" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Logo Image URL">
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="qk-input"
          />
        </Field>
        <Field label="Banner Image URL">
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://..."
            className="qk-input"
          />
        </Field>
      </div>

      <div>
        <span className="block text-xs font-medium text-muted mb-1.5">Ministries</span>
        {ministries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {ministries.map((m) => (
              <span key={m.id} className="text-xs bg-surface-2 border border-border-subtle text-muted px-2 py-1 rounded-full">
                {m.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Ministries appear here automatically once they&apos;re used on a lesson in Build a Lesson Experience.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-accent-blue-light">Church profile saved.</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save Church Profile"}
      </Button>
    </form>
  );
}
