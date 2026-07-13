"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Map,
  Target,
  BookOpen,
  BarChart3,
  ScrollText,
  Bell,
  User,
  ChevronsLeft,
  Building2,
  X,
  BookMarked,
  Clapperboard,
  CalendarHeart,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getUnreadCount } from "@/services/notificationService";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const memberLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/my-journey", label: "My Journey", icon: Map },
  { href: "/capture", label: "Capture", icon: Target },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/kingdom-scroll", label: "Kingdom Scroll", icon: ScrollText },
  { href: "/story", label: "Full Story", icon: BookMarked },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/events", label: "Events", icon: CalendarHeart },
];

const hostLinks = [
  { href: "/host-dashboard", label: "Host Dashboard", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/capture", label: "Capture", icon: Target },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/kingdom-scroll", label: "Kingdom Scroll", icon: ScrollText },
  { href: "/story", label: "Full Story", icon: BookMarked },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/events", label: "Events", icon: CalendarHeart },
];

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const { session } = useSession();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (session.isLoggedIn) setUnread(getUnreadCount(session.user.id));
  }, [session, pathname]);

  const links = session.accountType === "host" ? hostLinks : memberLinks;

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:flex p-2 rounded-lg hover:bg-white/5 text-muted focus-ring"
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft size={16} className={cn("transition-transform", collapsed && "rotate-180")} />
        </button>
        <button onClick={onCloseMobile} className="md:hidden p-2 rounded-lg hover:bg-white/5 text-muted focus-ring ml-auto">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-accent-blue/15 text-accent-blue-light" : "text-muted hover:text-foreground hover:bg-white/5"
              )}
              title={collapsed ? link.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-3 space-y-1 border-t border-border-subtle pt-3 mx-2">
        <Link
          href="/notifications"
          onClick={onCloseMobile}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
            pathname === "/notifications" ? "bg-accent-blue/15 text-accent-blue-light" : "text-muted hover:text-foreground hover:bg-white/5"
          )}
        >
          <Bell size={18} className="shrink-0" />
          {!collapsed && <span>Notifications</span>}
          {unread > 0 && (
            <span className="ml-auto text-[10px] w-5 h-5 rounded-full bg-accent-blue text-white flex items-center justify-center">
              {unread}
            </span>
          )}
        </Link>
        <Link
          href="/profile"
          onClick={onCloseMobile}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/profile" ? "bg-accent-blue/15 text-accent-blue-light" : "text-muted hover:text-foreground hover:bg-white/5"
          )}
        >
          <User size={18} className="shrink-0" />
          {!collapsed && <span>Profile</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:block shrink-0 border-r border-border-subtle bg-surface/40 transition-all duration-200",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r border-border-subtle">{content}</aside>
        </div>
      )}
    </>
  );
}
