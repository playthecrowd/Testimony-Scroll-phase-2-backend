"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { Button, LinkButton } from "@/components/ui/Button";
import { completeOrganizationSetup } from "./actions";

// Mirrors app/onboarding/church/page.tsx exactly (same 4 fields, same gate shape) with
// Organization terminology and account_type -- kept as a separate page (not a shared component
// with a label prop) because the two gates below intentionally diverge in which account_type they
// require, matching how the two entry cards on AuthScreen map to two distinct signup intents.
export default function OrganizationOnboardingPage() {
  const { session, ready, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("US");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!ready) return null;

  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in as an Organization account to complete setup.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  if (session.accountType !== "organization") {
    if (session.user.churchId) {
      return (
        <div className="max-w-lg mx-auto py-24 text-center px-4">
          <p className="text-foreground font-semibold mb-2">Only a manager of your organization can edit its profile.</p>
          <p className="text-muted text-sm mb-4">
            You&apos;re already a member of an organization -- ask your Organization manager if changes are needed.
          </p>
          <LinkButton href="/dashboard">Go to Dashboard</LinkButton>
        </div>
      );
    }
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Only Organization accounts can create an organization.</p>
        <LinkButton href="/dashboard">Go to Dashboard</LinkButton>
      </div>
    );
  }

  if (session.user.churchId) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You already manage an organization.</p>
        <LinkButton href="/host-dashboard">Go to Organization Dashboard</LinkButton>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await completeOrganizationSetup({ name, city, region, country });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();
    router.push("/host-dashboard");
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Complete Organization Setup</h1>
      <p className="text-muted text-sm mb-8">Tell us about your organization to start building lessons.</p>
      <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
        <Field label="Organization Name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Kingdom Outreach Network"
            required
            className="qk-input"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Atlanta" className="qk-input" />
          </Field>
          <Field label="Region / State">
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., GA" className="qk-input" />
          </Field>
        </div>
        <Field label="Country">
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g., US" className="qk-input" />
        </Field>

        {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating..." : "Create My Organization"}
        </Button>
      </form>

      <style jsx global>{`
        .qk-input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: 0.5rem;
          padding: 0.6rem 0.85rem;
          font-size: 0.875rem;
          color: var(--foreground);
        }
        .qk-input::placeholder {
          color: var(--muted);
        }
        .qk-input:focus {
          outline: 2px solid var(--accent-blue-light);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">
        {label} {required && <span className="text-accent-blue-light">*</span>}
      </span>
      {children}
    </label>
  );
}
