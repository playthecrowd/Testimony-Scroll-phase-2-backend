"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { qrCode } from "@/lib/images";

// Shared by the host's "Share & QR Code" card (church member management) and the public church
// page's "Share This Church" card -- both are just "copyable absolute link + QR image of that
// link," differing only in the path and surrounding copy.
//
// The absolute URL only exists client-side (window.location.origin) -- computed directly during
// render rather than via a useEffect+setState round-trip, so the server-rendered pass just shows
// the relative path for a moment instead of causing an extra render.
export function ShareLinkCard({ path }: { path: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input readOnly value={url} className="qk-input flex-1 min-w-0 text-xs" onFocus={(e) => e.target.select()} />
        <Button type="button" size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrCode(url)} alt="QR code" width={120} height={120} className="rounded-lg border border-border-subtle shrink-0" />
    </div>
  );
}
