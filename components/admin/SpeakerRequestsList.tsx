"use client";

import { useState } from "react";
import { Mail, Phone, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SpeakerRequest, SpeakerRequestStatus } from "@/types";
import { updateSpeakerRequestStatusAction } from "@/app/admin/speaker-requests/actions";

const STATUS_LABELS: Record<SpeakerRequestStatus, string> = {
  submitted: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
  declined: "Declined",
};

const STATUS_CLASSES: Record<SpeakerRequestStatus, string> = {
  submitted: "bg-accent-gold/15 text-accent-gold",
  reviewed: "bg-accent-blue/15 text-accent-blue-light",
  contacted: "bg-green-500/15 text-green-300",
  declined: "bg-red-500/15 text-red-300",
};

export function SpeakerRequestsList({ requests: initial }: { requests: SpeakerRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(id: string, status: SpeakerRequestStatus) {
    setPendingId(id);
    setError("");
    const result = await updateSpeakerRequestStatusAction(id, status);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted">No speaker requests yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {requests.map((r) => {
        const busy = pendingId === r.id;
        return (
          <div key={r.id} className="qk-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{r.name}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASSES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 flex flex-wrap items-center gap-x-3">
                  <span className="flex items-center gap-1">
                    <Mail size={11} /> {r.email}
                  </span>
                  {r.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} /> {r.phone}
                    </span>
                  )}
                  {(r.churchName || r.churchAffiliation) && <span>{r.churchName || r.churchAffiliation}</span>}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(r.id, "reviewed")}>
                  <Eye size={13} /> Reviewed
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(r.id, "contacted")}>
                  <CheckCircle2 size={13} /> Contacted
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(r.id, "declined")}>
                  <XCircle size={13} /> Decline
                </Button>
              </div>
            </div>
            {r.topic && (
              <p className="text-xs text-muted mt-1">
                <span className="text-foreground font-medium">Topic:</span> {r.topic}
              </p>
            )}
            {r.bio && <p className="text-xs text-muted mt-1">{r.bio}</p>}
            {r.message && <p className="text-xs text-muted mt-1 italic">&ldquo;{r.message}&rdquo;</p>}
          </div>
        );
      })}
    </div>
  );
}
