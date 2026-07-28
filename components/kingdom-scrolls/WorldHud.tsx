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
    <header
      className="ks-theme flex items-center justify-between gap-3 px-3 md:px-5 py-2.5 shrink-0"
      style={{
        background: "linear-gradient(180deg, var(--ks-panel-top) 0%, var(--ks-panel-bottom) 100%)",
        borderBottom: "1px solid var(--ks-bronze)",
        boxShadow: "inset 0 -2px 0 rgba(212,165,61,0.15)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Logo size="sm" />
        <span className="hidden md:inline text-sm font-bold tracking-[0.08em] whitespace-nowrap" style={{ color: "var(--ks-gold-light)" }}>
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
            className="ks-nav-link flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md focus-ring"
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {!isSignedIn && (
          <span className="ks-pill hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1">
            <Eye size={12} /> Public View
          </span>
        )}
        <button type="button" aria-label="Notifications" className="focus-ring rounded-full p-1.5" style={{ color: "var(--ks-text-dim)" }}>
          <Bell size={16} />
        </button>
        <button type="button" aria-label="Settings" className="focus-ring rounded-full p-1.5 hidden sm:block" style={{ color: "var(--ks-text-dim)" }}>
          <Settings size={16} />
        </button>
        {isSignedIn ? (
          <div className="flex items-center gap-2 pl-1">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" style={{ border: "1px solid var(--ks-bronze)" }} />
            ) : (
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: "rgba(212,165,61,0.15)", border: "1px solid var(--ks-bronze)", color: "var(--ks-gold-light)" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-semibold" style={{ color: "var(--ks-text)" }}>{displayName}</p>
              <p className="text-[10px]" style={{ color: "var(--ks-text-dim)" }}>
                {level != null ? `Level ${level} Scroll Seeker` : "Scroll Seeker"}
                {xpTotal != null ? ` · ${xpTotal.toLocaleString()} XP` : ""}
                {pointsTotal != null ? ` · ${pointsTotal.toLocaleString()} pts` : ""}
              </p>
            </div>
          </div>
        ) : (
          <Link href="/login?next=%2Fkingdom-scrolls" className="text-xs font-semibold hover:underline whitespace-nowrap" style={{ color: "var(--ks-gold)" }}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
