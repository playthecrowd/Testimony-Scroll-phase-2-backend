"use client";

import { useState } from "react";
import { Mic, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Reuses the church-slug-in-the-URL shape /become-a-speaker/[churchSlug] -- no token, no new
// backend, the slug is already a public, stable identifier (same trust level as /join/[churchSlug]).
export function CopySpeakerLinkCard({ churchSlug }: { churchSlug: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/become-a-speaker/${churchSlug}` : `/become-a-speaker/${churchSlug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) -- the link is still visible
      // and selectable in the input below, so this isn't a dead end.
    }
  }

  return (
    <div className="qk-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Mic size={15} className="text-accent-gold" />
        <p className="text-sm font-semibold text-foreground">Speaker Request Link</p>
      </div>
      <p className="text-xs text-muted mb-3">Share this link with anyone you&apos;d like to invite to become a speaker at your church.</p>
      <div className="flex gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="qk-input text-xs flex-1" />
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
