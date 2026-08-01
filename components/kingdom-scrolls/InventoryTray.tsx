"use client";

import { Package, ChevronDown, ChevronUp, Compass, Flame, Shield, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Lesson Relics / Kingdom Scrolls / inventory ownership (Section 13, 15, 28) are deferred phases --
// no kingdom_relics/kingdom_user_inventory schema exists yet. The icons below are illustrative
// development fixtures proving the tray's visual language (per the render-POC deliverable's
// Checkpoint 1 spec), NOT a real signed-in Seeker's actual inventory -- clearly labeled as such,
// never presented as real data.
const FIXTURE_ITEMS = [
  { icon: Compass, label: "Call Compass", state: "owned" as const },
  { icon: Flame, label: "Living Flame", state: "owned" as const },
  { icon: Shield, label: "Endurance Shield", state: "equipped" as const },
  { icon: Lock, label: "Locked", state: "locked" as const },
  { icon: Lock, label: "Locked", state: "locked" as const },
];

export function InventoryTray({ collapsed, onToggle, isSignedIn }: { collapsed: boolean; onToggle: () => void; isSignedIn: boolean }) {
  return (
    <div
      className={cn("ks-dock-panel border-t shrink-0 transition-[height] duration-200 overflow-hidden", collapsed ? "h-11" : "h-28")}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--ks-bronze-dim)" }}>
        <span className="ks-panel-title flex items-center gap-1.5">
          <Package size={14} /> Seeker Inventory
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand inventory tray" : "Collapse inventory tray"}
          className="focus-ring rounded p-1"
          style={{ color: "var(--ks-text-dim)" }}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div className="h-full flex items-center gap-2 px-4 overflow-x-auto qk-scrollbar" tabIndex={0}>
          {isSignedIn ? (
            <>
              {FIXTURE_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={cn("ks-panel w-14 h-14 shrink-0 flex flex-col items-center justify-center gap-0.5", item.state === "locked" && "opacity-40")}
                  title={`${item.label} (${item.state}) -- development fixture, not real inventory`}
                >
                  <item.icon size={18} style={{ color: item.state === "locked" ? "var(--ks-text-dim)" : "var(--ks-gold)" }} />
                  {item.state === "equipped" && <span className="text-[7px] font-bold uppercase" style={{ color: "var(--ks-gold-light)" }}>Equipped</span>}
                </div>
              ))}
              <p className="text-[10px] ml-2" style={{ color: "var(--ks-text-dim)" }}>
                Illustrative fixture -- real Lesson Relics unlock as lessons are completed, once the relic system is built.
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--ks-text-dim)" }}>Sign in to start collecting Lesson Relics and Kingdom Scrolls.</p>
          )}
        </div>
      )}
    </div>
  );
}
