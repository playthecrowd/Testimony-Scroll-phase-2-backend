"use client";

import { Package, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Lesson Relics / Kingdom Scrolls / inventory ownership (Section 13, 15, 28) are deferred phases --
// no kingdom_relics/kingdom_user_inventory schema exists yet. This renders the tray shell and a
// truthful empty state rather than fabricated item icons, per the audit's "no hard-coded real
// data" rule.
export function InventoryTray({ collapsed, onToggle, isSignedIn }: { collapsed: boolean; onToggle: () => void; isSignedIn: boolean }) {
  return (
    <div className={cn("qk-card rounded-none border-x-0 border-b-0 shrink-0 transition-[height] duration-200 overflow-hidden", collapsed ? "h-11" : "h-28")}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-xs font-bold uppercase tracking-wide text-accent-blue-light flex items-center gap-1.5">
          <Package size={14} /> Seeker Inventory
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand inventory tray" : "Collapse inventory tray"}
          className="text-muted hover:text-foreground focus-ring rounded p-1"
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div className="h-full flex items-center px-4 overflow-x-auto qk-scrollbar" tabIndex={0}>
          <p className="text-xs text-muted">
            {isSignedIn
              ? "Your inventory is empty. Complete a lesson to earn your first Lesson Relic -- coming in a future update."
              : "Sign in to start collecting Lesson Relics and Kingdom Scrolls."}
          </p>
        </div>
      )}
    </div>
  );
}
