"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// A compact, collapsed-by-default card -- icon, heading, one-line preview, chevron -- matching
// WF-02's stacked content cards. Deliberately never a large empty rectangle: the body only mounts
// once expanded, and the preview line is what shows by default.
export function DecisionAccordion({
  icon: Icon,
  heading,
  preview,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  heading: string;
  preview: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="qk-card rounded-xl border border-accent-gold/25">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left focus-ring rounded-xl"
        aria-expanded={open}
      >
        <Icon size={17} className="text-accent-gold mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{heading}</div>
          {!open && <p className="text-xs text-muted mt-0.5 line-clamp-1">{preview}</p>}
        </div>
        <ChevronDown size={16} className={`text-muted shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pl-[2.4rem] text-sm text-muted">{children}</div>}
    </div>
  );
}
