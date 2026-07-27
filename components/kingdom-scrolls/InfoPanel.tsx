"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ScrollText, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

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
          "hidden md:flex flex-col qk-card rounded-none border-y-0 border-r-0 shrink-0 transition-[width] duration-200",
          collapsed ? "w-12" : "w-80"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-border-subtle">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand info panel" : "Collapse info panel"}
            className="text-muted hover:text-foreground focus-ring rounded p-1"
          >
            <ScrollText size={16} />
          </button>
          {!collapsed && <span className="text-xs font-bold uppercase tracking-wide text-accent-blue-light ml-auto">My Ground View</span>}
        </div>
        {!collapsed && <div className="p-4 flex-1 overflow-y-auto qk-scrollbar">{body}</div>}
      </aside>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="View lesson and quest details"
          className="fixed right-3 bottom-24 z-20 qk-card w-10 h-10 rounded-full flex items-center justify-center text-accent-blue-light focus-ring"
        >
          <ScrollText size={18} />
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-30 flex items-end" role="dialog" aria-label="My Ground View">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <div className="relative w-full qk-card rounded-b-none p-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-foreground">My Ground View</span>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="text-muted hover:text-foreground focus-ring rounded p-1">
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
        <ScrollText size={28} className="text-accent-blue-light mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground mb-1">Sign in to see your quest</p>
        <p className="text-xs text-muted mb-4">Your daily lesson, inventory, and Kingdom Scroll live here once you sign in.</p>
        <Link href="/login?next=%2Fkingdom-scrolls">
          <Button size="sm">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (!hasChurch) {
    return (
      <div className="text-center py-6">
        <ScrollText size={28} className="text-accent-blue-light mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground mb-1">Join a church to claim your plot</p>
        <p className="text-xs text-muted mb-4">Your Church Land and Member Plot unlock once you join a church.</p>
        <Link href="/churches">
          <Button size="sm">Explore Churches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Daily Lesson</p>
        {dailyLesson ? (
          <div className="qk-card p-3">
            {dailyLesson.monthLabel && <p className="text-[10px] text-accent-blue-light font-semibold uppercase mb-1">{dailyLesson.monthLabel}</p>}
            <p className="text-sm font-bold text-foreground leading-snug">{dailyLesson.title}</p>
            {dailyLesson.scripture && <p className="text-xs text-muted mt-1">{dailyLesson.scripture}</p>}
            <Link href={dailyLesson.href} className="block mt-3">
              <Button size="sm" className="w-full">
                <BookOpen size={14} /> Begin Lesson
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted">No campaign lesson is live this week yet.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Seeker Inventory</p>
        <p className="text-xs text-muted leading-relaxed">
          Lesson Relics and Kingdom Scrolls will appear here as you complete lessons -- coming in a future update.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Personal Quest</p>
        <p className="text-xs text-muted leading-relaxed">
          Testimony Delivery Missions are coming in a future update.
        </p>
      </div>
    </div>
  );
}
