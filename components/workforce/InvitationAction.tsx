"use client";

import { useState } from "react";
import { WorkforceDepartment } from "@/types";

// A single invite trigger + its own inline form (department picker or email input). Presentational
// only -- the actual request (createInvitationRequest, unchanged) is supplied by the caller via
// onSubmit, matching this phase's existing invitation logic and RLS scope exactly. Visual pass
// only: no new request types, no new permissions.
export function InvitationAction({
  label,
  kind,
  departments,
  onSubmit,
  fullWidth,
}: {
  label: string;
  kind: "department" | "specific_person";
  departments?: WorkforceDepartment[];
  onSubmit: (value: string) => Promise<{ error?: string } | void>;
  fullWidth?: boolean;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!value.trim()) {
      setError(kind === "department" ? "Choose a department." : "Enter an email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await onSubmit(value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpenForm(false);
      setValue("");
    } catch {
      setError("We could not save this change. Your previous information is still available.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={fullWidth ? "w-full" : ""}>
      <button
        onClick={() => setOpenForm((v) => !v)}
        className={`text-xs font-medium border border-accent-blue text-accent-blue hover:bg-accent-blue/10 rounded-lg px-3 py-1.5 transition-colors ${fullWidth ? "w-full" : ""}`}
      >
        {label}
      </button>
      {openForm && (
        <div className="mt-2 bg-surface-2 border border-border-subtle rounded-lg p-2.5 space-y-2">
          {kind === "department" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs"
            >
              <option value="">Choose a department</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Email address"
              className="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs"
            />
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send Request"}
          </button>
        </div>
      )}
    </div>
  );
}
