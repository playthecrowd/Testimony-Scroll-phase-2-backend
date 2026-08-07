"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { createDecision } from "@/services/supabase/workforceDecisions";
import { WorkforceDecisionPriority, WorkforceDecisionSecurity, WorkforceDepartment } from "@/types";

export function NewDecisionForm({ churchId, departments }: { churchId: string; departments: WorkforceDepartment[] }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<WorkforceDecisionPriority>("standard");
  const [security, setSecurity] = useState<WorkforceDecisionSecurity>("internal");
  const [departmentId, setDepartmentId] = useState("");
  const [controllingStakeholderGroup, setControllingStakeholderGroup] = useState("");
  const [executiveIntent, setExecutiveIntent] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const supabase = createClient();
      const decision = await createDecision(supabase, {
        churchId,
        title,
        priority,
        security,
        departmentId: departmentId || null,
        controllingStakeholderGroup,
        decisionOwner: null,
        executiveIntent,
        desiredOutcome,
        targetDate: targetDate || null,
      });
      router.push(`/workforce/decisions/${decision.id}`);
    } catch {
      setError("We could not save this decision. Your previous information is still available.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Field label="Title" required>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WorkforceDecisionPriority)}
            className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
          >
            <option value="standard">Standard</option>
            <option value="elevated">Elevated</option>
            <option value="strategic">Strategic</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
        <Field label="Security">
          <select
            value={security}
            onChange={(e) => setSecurity(e.target.value as WorkforceDecisionSecurity)}
            className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="restricted">Restricted</option>
            <option value="confidential">Confidential</option>
          </select>
        </Field>
      </div>
      <Field label="Department">
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Not yet assigned</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Controlling Stakeholder">
        <input
          value={controllingStakeholderGroup}
          onChange={(e) => setControllingStakeholderGroup(e.target.value)}
          placeholder="e.g. Enterprise Operations Council"
          className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Executive Intent">
        <textarea
          value={executiveIntent}
          onChange={(e) => setExecutiveIntent(e.target.value)}
          rows={3}
          className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Desired Outcome">
        <textarea
          value={desiredOutcome}
          onChange={(e) => setDesiredOutcome(e.target.value)}
          rows={3}
          className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Target Date">
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Decision"}
      </Button>
    </form>
  );
}
