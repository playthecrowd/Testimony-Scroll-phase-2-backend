"use client";

import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { UpperKingdomLocation } from "@/lib/kingdomScrollsWorld";

// Closes the "inert markers" gap identified in the approved plan (§2): every Upper Kingdom
// location is now a real, focusable button that opens this popup on click/Enter, not just a
// decorative dot. `screenX`/`screenY` are the location's raw WORLD coordinates (not actual screen
// pixels) -- this renders inside the same camera-transformed container as the map, so the outer
// anchor div's position naturally pans/zooms correctly along with everything else. The popup panel
// itself then applies an inverse `scale(1 / cameraScale)` so its on-screen size stays constant
// instead of shrinking/growing with the world zoom (at MIN_ZOOM/MAX_ZOOM that scaling would
// otherwise range from ~35% to ~250% of the authored size, making it unreadable or oversized).
export function LocationPopup({
  location,
  screenX,
  screenY,
  cameraScale,
  onClose,
}: {
  location: UpperKingdomLocation;
  screenX: number;
  screenY: number;
  cameraScale: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute z-20" style={{ left: screenX, top: screenY + 16 }}>
      <div
        role="dialog"
        aria-label={location.label}
        className="ks-panel w-64 p-4"
        style={{ transform: `scale(${1 / cameraScale}) translateX(-50%)`, transformOrigin: "0 0" }}
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
    </div>
  );
}
