"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, ScrollText, ChevronUp, Sparkles, Award, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { backgrounds } from "@/data/backgrounds";

export interface DailyLessonInfo {
  title: string;
  scripture: string | null;
  href: string;
  monthLabel: string | null;
}

export function InfoPanel({
  collapsed,
  onToggle,
  isSignedIn,
  hasChurch,
  dailyLesson,
}: {
  collapsed: boolean;
  onToggle: () => void;
  isSignedIn: boolean;
  hasChurch: boolean;
  dailyLesson: DailyLessonInfo | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const body = <InfoPanelBody isSignedIn={isSignedIn} hasChurch={hasChurch} dailyLesson={dailyLesson} />;

  return (
    <>
      <aside
        className={cn(
          "ks-dock-panel hidden md:flex flex-col border-l shrink-0 transition-[width] duration-200",
          collapsed ? "w-12" : "w-80"
        )}
      >
        <div className="flex items-center justify-between p-3" style={{ borderBottom: "1px solid var(--ks-bronze-dim)" }}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand info panel" : "Collapse info panel"}
            className="focus-ring rounded p-1"
            style={{ color: "var(--ks-text-dim)" }}
          >
            <ScrollText size={16} />
          </button>
          {!collapsed && <span className="ks-panel-title ml-auto">My Ground View</span>}
        </div>
        {!collapsed && <div className="p-4 flex-1 overflow-y-auto qk-scrollbar">{body}</div>}
      </aside>

      {/* bottom-32 (not bottom-24) so this stays clear of the InventoryTray when a mobile user
          expands it -- the tray's expanded height (h-28/112px) would otherwise overlap a button
          anchored at bottom-24/96px by ~16px. */}
      <div className="md:hidden ks-theme">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="View lesson and quest details"
          className="ks-dock-panel border fixed right-3 bottom-32 z-20 w-10 h-10 rounded-full flex items-center justify-center focus-ring"
          style={{ color: "var(--ks-gold)" }}
        >
          <ScrollText size={18} />
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-30 flex items-end" role="dialog" aria-label="My Ground View">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <div className="ks-dock-panel relative w-full border-t p-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: "var(--ks-gold-light)" }}>My Ground View</span>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="focus-ring rounded p-1" style={{ color: "var(--ks-text-dim)" }}>
                  <ChevronUp size={18} className="rotate-180" />
                </button>
              </div>
              {body}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoPanelBody({
  isSignedIn,
  hasChurch,
  dailyLesson,
}: {
  isSignedIn: boolean;
  hasChurch: boolean;
  dailyLesson: DailyLessonInfo | null;
}) {
  if (!isSignedIn) {
    return (
      <div className="text-center py-6">
        <ScrollText size={28} className="mx-auto mb-3" style={{ color: "var(--ks-gold)" }} />
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--ks-text)" }}>Sign in to see your quest</p>
        <p className="text-xs mb-4" style={{ color: "var(--ks-text-dim)" }}>Your daily lesson, inventory, and Kingdom Scroll live here once you sign in.</p>
        <Link href="/login?next=%2Fkingdom-scrolls">
          <Button size="sm">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (!hasChurch) {
    return (
      <div className="text-center py-6">
        <ScrollText size={28} className="mx-auto mb-3" style={{ color: "var(--ks-gold)" }} />
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--ks-text)" }}>Join a church to claim your plot</p>
        <p className="text-xs mb-4" style={{ color: "var(--ks-text-dim)" }}>Your Church Land and Member Plot unlock once you join a church.</p>
        <Link href="/churches">
          <Button size="sm">Explore Churches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="ks-panel-title mb-2">Daily Lesson</p>
        {dailyLesson ? (
          <div className="ks-panel p-3">
            {dailyLesson.monthLabel && <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--ks-gold)" }}>{dailyLesson.monthLabel}</p>}
            <p className="text-sm font-bold leading-snug" style={{ color: "var(--ks-text)" }}>{dailyLesson.title}</p>
            {dailyLesson.scripture && <p className="text-xs mt-1" style={{ color: "var(--ks-text-dim)" }}>{dailyLesson.scripture}</p>}
            <Link href={dailyLesson.href} className="block mt-3">
              <Button size="sm" className="w-full">
                <BookOpen size={14} /> Begin Lesson
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--ks-text-dim)" }}>No campaign lesson is live this week yet.</p>
        )}
      </div>

      {/* Equipped Kingdom Scroll -- a fixed development fixture for Checkpoint 1 (per the render-POC
          deliverable's spec), NOT tied to any real ownership record. No kingdom_scrolls table
          exists yet, so this never claims the signed-in Seeker actually owns/equipped one. */}
      <div>
        <p className="ks-panel-title mb-2">Equipped</p>
        <div className="ks-panel p-3 flex items-center gap-3">
          <div className="relative w-12 h-12 shrink-0">
            <Image src={backgrounds.kingdomScrollsTestimonyScroll} alt="" fill className="object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "var(--ks-gold-light)" }}>Testimony Scroll</p>
            <p className="text-[10px]" style={{ color: "var(--ks-text-dim)" }}>Development fixture -- Kingdom Scroll ownership isn&apos;t tracked yet.</p>
          </div>
        </div>
      </div>

      {/* Zeroed stat rows -- per the render-POC deliverable's Checkpoint 1 spec: "add zeroed stat
          rows now instead of hiding the section." These are fixed zeros, not a real query against
          a table that doesn't exist yet -- shown as a development fixture, never implied as a real
          count. Representative relic icons live in the bottom InventoryTray instead of duplicating
          fixture content here. */}
      <div>
        <p className="ks-panel-title mb-2">Seeker Inventory</p>
        <div className="ks-panel p-3 space-y-2">
          <StatRow icon={Sparkles} label="Kingdom Scrolls" value={0} />
          <StatRow icon={Award} label="Lesson Relics" value="0 / 48" />
          <StatRow icon={Send} label="Testimonies Delivered" value={0} />
        </div>
        <p className="text-[10px] mt-2" style={{ color: "var(--ks-text-dim)" }}>
          Development fixture -- these counts aren&apos;t tracked by a real table yet.
        </p>
      </div>

      <div>
        <p className="ks-panel-title mb-2">Personal Quest</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--ks-text-dim)" }}>
          Testimony Delivery Missions are coming in a future update.
        </p>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={14} style={{ color: "var(--ks-gold)" }} />
      <span className="flex-1" style={{ color: "var(--ks-text-dim)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--ks-text)" }}>{value}</span>
    </div>
  );
}
