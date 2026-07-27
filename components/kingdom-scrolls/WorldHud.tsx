"use client";

import Link from "next/link";
import { Map, BookOpen, Package, ScrollText, Users, Bell, Settings, Eye } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

export function WorldHud({
  displayName,
  avatarUrl,
  level,
  xpTotal,
  pointsTotal,
  isSignedIn,
}: {
  displayName: string;
  avatarUrl: string | null;
  level: number | null;
  xpTotal: number | null;
  pointsTotal: number | null;
  isSignedIn: boolean;
}) {
  return (
    <header className="qk-card rounded-none border-x-0 border-t-0 flex items-center justify-between gap-3 px-3 md:px-5 py-2.5 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Logo size="sm" />
        <span className="hidden md:inline text-sm font-bold text-foreground tracking-wide whitespace-nowrap">
          THE KINGDOM SCROLLS
        </span>
      </div>

      <nav className="hidden lg:flex items-center gap-1" aria-label="Kingdom Scrolls navigation">
        {[
          { icon: Map, label: "World Map" },
          { icon: BookOpen, label: "Lessons" },
          { icon: Package, label: "Inventory" },
          { icon: ScrollText, label: "Testimonies" },
          { icon: Users, label: "Seekers" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-surface-2 focus-ring"
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {!isSignedIn && (
          <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-accent-blue-light border border-accent-blue-light/40 rounded-full px-2.5 py-1">
            <Eye size={12} /> Public View
          </span>
        )}
        <button type="button" aria-label="Notifications" className="text-muted hover:text-foreground focus-ring rounded-full p-1.5">
          <Bell size={16} />
        </button>
        <button type="button" aria-label="Settings" className="text-muted hover:text-foreground focus-ring rounded-full p-1.5 hidden sm:block">
          <Settings size={16} />
        </button>
        {isSignedIn ? (
          <div className="flex items-center gap-2 pl-1">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-border-subtle" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-accent-blue/20 border border-accent-blue-light/40 flex items-center justify-center text-[11px] font-bold text-accent-blue-light">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-semibold text-foreground">{displayName}</p>
              <p className="text-[10px] text-muted">
                {level != null ? `Level ${level} Scroll Seeker` : "Scroll Seeker"}
                {xpTotal != null ? ` · ${xpTotal.toLocaleString()} XP` : ""}
                {pointsTotal != null ? ` · ${pointsTotal.toLocaleString()} pts` : ""}
              </p>
            </div>
          </div>
        ) : (
          <Link href="/login?next=%2Fkingdom-scrolls" className="text-xs font-semibold text-accent-blue-light hover:underline whitespace-nowrap">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
