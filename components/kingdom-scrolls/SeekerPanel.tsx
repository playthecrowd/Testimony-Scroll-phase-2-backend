"use client";

import { useState } from "react";
import { Users, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Live presence (Section 21) is a deferred phase -- there is no real-time provider wired up yet
// anywhere in this codebase (confirmed during the pre-implementation audit). Showing fabricated
// seeker names here would violate "do not hard-code real data into visual components," so this
// renders an honest empty state instead of inventing people.
export function SeekerPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop / tablet: persistent collapsible side panel */}
      <aside
        className={cn(
          "hidden md:flex flex-col qk-card rounded-none border-y-0 border-l-0 shrink-0 transition-[width] duration-200",
          collapsed ? "w-12" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-border-subtle">
          {!collapsed && <span className="text-xs font-bold uppercase tracking-wide text-accent-blue-light">Live Seekers</span>}
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand Seeker panel" : "Collapse Seeker panel"}
            className="text-muted hover:text-foreground focus-ring rounded p-1 ml-auto"
          >
            <Users size={16} />
          </button>
        </div>
        {!collapsed && (
          <div className="p-4 flex-1 overflow-y-auto qk-scrollbar">
            <p className="text-xs text-muted leading-relaxed">
              Seeing who else is exploring the Kingdom right now is coming in a future update.
            </p>
          </div>
        )}
      </aside>

      {/* Mobile: bottom-sheet trigger + drawer, matching the responsive spec's "Seeker drawer" */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="View Seekers"
          className="fixed left-3 bottom-24 z-20 qk-card w-10 h-10 rounded-full flex items-center justify-center text-accent-blue-light focus-ring"
        >
          <Users size={18} />
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-30 flex items-end" role="dialog" aria-label="Live Seekers">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <div className="relative w-full qk-card rounded-b-none p-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-foreground">Live Seekers</span>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="text-muted hover:text-foreground focus-ring rounded p-1">
                  <ChevronDown size={18} />
                </button>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Seeing who else is exploring the Kingdom right now is coming in a future update.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
