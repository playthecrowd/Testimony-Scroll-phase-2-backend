"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

// Shared by both join entry points (generic church link/QR and an individual email invite) --
// both are "call a server action, then land on the church page" with the same loading/error
// shape, just a different action and success destination.
export function JoinActionButton<T extends { error?: string }>({
  label,
  action,
  onSuccessHref,
}: {
  label: string;
  action: () => Promise<T>;
  onSuccessHref: (result: T) => string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setSubmitting(true);
    setError("");
    const result = await action();
    setSubmitting(false);
    const href = onSuccessHref(result);
    if (result.error || !href) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.push(href);
  }

  return (
    <div className="text-center">
      <Button size="lg" onClick={handleClick} disabled={submitting}>
        {submitting ? "Joining..." : label}
      </Button>
      {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
    </div>
  );
}
