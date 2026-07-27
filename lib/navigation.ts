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
  HeartHandshake,
  Megaphone,
  UploadCloud,
  Castle,
  Users2,
} from "lucide-react";

// Single source of truth for the "is this link Host-only" question, consulted by both Sidebar
// (desktop + mobile drawer -- one component, so it was never actually possible for those two to
// disagree) and TopBar, so the two can't drift into different role rules again. Route protection
// itself lives server-side in app/experience-builder/page.tsx regardless of what's shown here --
// this only controls visibility. platformAdminOnly follows the same rule for admin-only links
// (e.g. Campaign Lessons): gated here, not by a separate check re-added in Sidebar.tsx. Unlike
// hostOnly (which picks between two whole link arrays), platformAdminOnly is orthogonal to
// accountType, so Sidebar filters it in directly.
export interface AppNavLink {
  href: string;
  label: string;
  icon?: LucideIcon;
  hostOnly?: boolean;
  platformAdminOnly?: boolean;
}

// Events moved earlier in every nav surface per Part 18 #1 ("move Events to a more visible
// location") -- previously last in both sidebars and second-to-last in the top nav.
// "Experiences" (Phase 10.3, church-scheduled discipleship activities) is a deliberately distinct
// label from the existing "Build Experience" (lesson creation, host-only) -- the two concepts'
// naming overlap is documented, accepted technical debt (docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md
// SS2/SS30), not resolved by renaming either one here.
export const SIDEBAR_MEMBER_LINKS: AppNavLink[] = [
  { href: "/dashboard", label: "My Dashboard", icon: LayoutGrid },
  { href: "/my-journey", label: "My Journey", icon: Map },
  { href: "/kingdom-scrolls", label: "The Kingdom Scrolls", icon: Castle },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/experiences", label: "Experiences", icon: HeartHandshake },
  { href: "/events", label: "Events", icon: CalendarHeart },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/kingdom-scroll", label: "Kingdom Scroll", icon: ScrollText },
  { href: "/story", label: "Full Story", icon: BookMarked },
  { href: "/characters", label: "Characters", icon: Users2 },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/admin/campaign-lessons", label: "Campaign Lessons", icon: Megaphone, platformAdminOnly: true },
];

export const SIDEBAR_HOST_LINKS: AppNavLink[] = [
  { href: "/host-dashboard", label: "Host Dashboard", icon: Building2 },
  { href: "/dashboard", label: "My Dashboard", icon: LayoutGrid },
  { href: "/kingdom-scrolls", label: "The Kingdom Scrolls", icon: Castle },
  { href: "/experience-builder", label: "Build Experience", icon: Target, hostOnly: true },
  { href: "/experience-builder/import", label: "Bulk Upload Lessons", icon: UploadCloud, hostOnly: true },
  { href: "/host-dashboard/experiences", label: "Experiences", icon: HeartHandshake, hostOnly: true },
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/events", label: "Events", icon: CalendarHeart },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/kingdom-scroll", label: "Kingdom Scroll", icon: ScrollText },
  { href: "/story", label: "Full Story", icon: BookMarked },
  { href: "/characters", label: "Characters", icon: Users2 },
  { href: "/episodes", label: "Episodes", icon: Clapperboard },
  { href: "/admin/campaign-lessons", label: "Campaign Lessons", icon: Megaphone, platformAdminOnly: true },
];

export const TOPBAR_LINKS: AppNavLink[] = [
  { href: "/experience-builder", label: "Experience Builder", hostOnly: true },
  { href: "/lessons", label: "Explore" },
  { href: "/churches", label: "Churches" },
  { href: "/lessons", label: "Lessons" },
  { href: "/events", label: "Events" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/kingdom-scroll", label: "Kingdom Scroll" },
  { href: "/about", label: "About" },
];

// TopBar is shown to anonymous visitors too, so this takes the full session shape rather than
// assuming a logged-in user.
export function visibleTopBarLinks(isHost: boolean): AppNavLink[] {
  return TOPBAR_LINKS.filter((link) => !link.hostOnly || isHost);
}
