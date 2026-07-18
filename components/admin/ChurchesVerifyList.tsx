"use client";

import { useState } from "react";
import { ShieldCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PublishedChurch } from "@/types";
import { updateChurchVerifiedAction } from "@/app/admin/churches/actions";

export function ChurchesVerifyList({ churches: initial }: { churches: PublishedChurch[] }) {
  const [churches, setChurches] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(id: string, verified: boolean) {
    setPendingId(id);
    setError("");
    const result = await updateChurchVerifiedAction(id, verified);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setChurches((prev) => prev.map((c) => (c.id === id ? { ...c, verified } : c)));
  }

  if (churches.length === 0) {
    return <p className="text-sm text-muted">No churches yet.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {churches.map((c) => {
        const busy = pendingId === c.id;
        return (
          <div key={c.id} className="qk-card p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
              <p className="text-[11px] text-muted truncate">{[c.city, c.region].filter(Boolean).join(", ")}</p>
            </div>
            <Button size="sm" variant={c.verified ? "secondary" : "ghost"} disabled={busy} onClick={() => toggle(c.id, !c.verified)}>
              {c.verified ? <ShieldCheck size={13} /> : <Shield size={13} />} {c.verified ? "Verified" : "Verify"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
