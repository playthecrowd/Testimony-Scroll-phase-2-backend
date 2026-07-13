"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { Button, LinkButton } from "@/components/ui/Button";
import { completeChurchSetup } from "./actions";

export default function ChurchOnboardingPage() {
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
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host to complete setup.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  if (session.accountType !== "host") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Only Church Host accounts can create a church.</p>
        <LinkButton href="/dashboard">Go to Dashboard</LinkButton>
      </div>
    );
  }

  if (session.user.churchId) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">You already manage a church.</p>
        <LinkButton href="/host-dashboard">Go to Host Dashboard</LinkButton>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await completeChurchSetup({ name, city, region, country });
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
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Complete Church Setup</h1>
      <p className="text-muted text-sm mb-8">Tell us about your church to start capturing lessons.</p>
      <form onSubmit={handleSubmit} className="qk-card p-5 space-y-4">
        <Field label="Church Name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Radiant Life Church"
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
          {submitting ? "Creating..." : "Create My Church"}
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
