"use client";

import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { UpperKingdomLocation } from "@/lib/kingdomScrollsWorld";

// Closes the "inert markers" gap identified in the approved plan (§2): every Upper Kingdom
// location is now a real, focusable button that opens this popup on click/Enter, not just a
// decorative dot. Screen coordinates are computed by the caller (MapViewport) from the same
// camera transform driving everything else, so the popup tracks the marker correctly at any pan/
// zoom level.
export function LocationPopup({ location, screenX, screenY, onClose }: { location: UpperKingdomLocation; screenX: number; screenY: number; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label={location.label}
      className="ks-panel absolute z-20 w-64 p-4 -translate-x-1/2"
      style={{ left: screenX, top: screenY + 16 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-2 right-2 focus-ring rounded p-1"
        style={{ color: "var(--ks-text-dim)" }}
      >
        <X size={14} />
      </button>
      <h3 className="text-sm font-bold pr-5" style={{ color: "var(--ks-gold-light)" }}>
        {location.label}
      </h3>
      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--ks-text-dim)" }}>
        {location.purpose}
      </p>
      {location.href ? (
        <Link href={location.href} className="ks-btn text-xs px-3 py-1.5 mt-3 w-full">
          Enter <ArrowRight size={13} />
        </Link>
      ) : (
        <p className="text-[11px] mt-3 italic" style={{ color: "var(--ks-text-dim)" }}>
          Nothing to open here yet.
        </p>
      )}
    </div>
  );
}
