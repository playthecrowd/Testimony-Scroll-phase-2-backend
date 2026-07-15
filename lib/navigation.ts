import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Map,
  Target,
  BookOpen,
  BarChart3,
  ScrollText,
  BookMarked,
  Clapperboard,
  CalendarHeart,
  Building2,
} from "lucide-react";

// Single source of truth for the "is this link Host-only" question, consulted by both Sidebar
// (desktop + mobile drawer -- one component, so it was never actually possible for those two to
// disagree) and TopBar, so the two can't drift into different role rules again. Route protection
// itself lives server-side in app/experience-builder/page.tsx regardless of what's shown here --
// this only controls visibility.
export interface AppNavLink {
  href: string;
  label: string;
  icon?: LucideIcon;
  hostOnly?: boolean;
}

export const SIDEBAR_MEMBER_LINKS: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/my-journey", label: "My Journey", icon: Map },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/kingdom-scroll", label: "Kingdom Scroll", icon: ScrollText },
  { href: "/story", label: "Full Story", icon: BookMarked },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/events", label: "Events", icon: CalendarHeart },
];

export const SIDEBAR_HOST_LINKS: AppNavLink[] = [
  { href: "/host-dashboard", label: "Host Dashboard", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/experience-builder", label: "Build Experience", icon: Target, hostOnly: true },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/kingdom-scroll", label: "Kingdom Scroll", icon: ScrollText },
  { href: "/story", label: "Full Story", icon: BookMarked },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/events", label: "Events", icon: CalendarHeart },
];

export const TOPBAR_LINKS: AppNavLink[] = [
  { href: "/experience-builder", label: "Experience Builder", hostOnly: true },
  { href: "/lessons", label: "Explore" },
  { href: "/churches", label: "Churches" },
  { href: "/lessons", label: "Lessons" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/kingdom-scroll", label: "Kingdom Scroll" },
  { href: "/events", label: "Events" },
  { href: "/about", label: "About" },
];

// TopBar is shown to anonymous visitors too, so this takes the full session shape rather than
// assuming a logged-in user.
export function visibleTopBarLinks(isHost: boolean): AppNavLink[] {
  return TOPBAR_LINKS.filter((link) => !link.hostOnly || isHost);
}
