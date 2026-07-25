"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChurchExperienceAttendanceStatus, ChurchMember } from "@/types";
import { recordWalkInAction } from "@/app/host-dashboard/experiences/actions";

// Existing-member walk-ins only (Phase 10.3, checkpoint 7) -- no anonymous/guest attendee concept
// exists in the schema, so this only ever searches/selects a real church member who does not
// already have a registration for this occurrence. Capacity is enforced by default; the override
// requires an explicit, separate confirmation step so it's never accidental.
export function WalkInForm({
  occurrenceId,
  eligibleMembers,
  atCapacity,
}: {
  occurrenceId: string;
  eligibleMembers: ChurchMember[];
  atCapacity: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<ChurchExperienceAttendanceStatus>("attended");
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleMembers;
    return eligibleMembers.filter((m) => (m.fullName ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [eligibleMembers, query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !selectedProfileId) return;
    if (atCapacity && !confirmOverride) {
      setError("This occurrence is at capacity. Confirm the override checkbox below to record this walk-in anyway.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await recordWalkInAction(occurrenceId, selectedProfileId, attendanceStatus, atCapacity && confirmOverride);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSelectedProfileId("");
    setQuery("");
    setConfirmOverride(false);
    router.refresh();
  }

  if (eligibleMembers.length === 0) {
    return <p className="text-sm text-muted">Every church member is already registered for this occurrence.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search members by name or email..."
        className="qk-input"
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.map((m) => (
          <label key={m.profileId} className="qk-card p-2 flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="walk-in-member"
              checked={selectedProfileId === m.profileId}
              onChange={() => setSelectedProfileId(m.profileId)}
            />
            <span className="text-xs text-foreground">{m.fullName || m.email}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted px-1">No matching member.</p>}
      </div>

      <label className="text-xs text-muted flex items-center gap-2">
        Attendance
        <select value={attendanceStatus} onChange={(e) => setAttendanceStatus(e.target.value as ChurchExperienceAttendanceStatus)} className="qk-input w-auto">
          <option value="attended">Attended</option>
          <option value="excused">Excused</option>
        </select>
      </label>

      {atCapacity && (
        <label className="flex items-start gap-2 text-xs text-accent-gold bg-accent-gold/10 border border-accent-gold/30 rounded-lg px-3 py-2">
          <input type="checkbox" checked={confirmOverride} onChange={(e) => setConfirmOverride(e.target.checked)} className="mt-0.5" />
          This occurrence is at capacity. I intentionally want to record this walk-in anyway (recorded as an over-capacity override).
        </label>
      )}

      {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <Button type="submit" size="sm" disabled={submitting || !selectedProfileId}>
        <UserPlus size={14} /> {submitting ? "Recording..." : "Record Walk-In"}
      </Button>
    </form>
  );
}
