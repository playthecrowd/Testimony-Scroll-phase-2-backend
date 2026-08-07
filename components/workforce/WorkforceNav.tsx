"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ClipboardList, CalendarClock, Sparkles, Layers, Users, FileCheck2, Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkforceNavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  managerOnly?: boolean;
}

// The approved Workforce module-level menu (spec section 5 of the UI content guide). Items with no
// built destination yet route to /workforce/coming-soon rather than a dead link or a 404 -- see
// that page for why. Vendors/Administration are permission-controlled per the spec; gated by
// isManager here since neither has a real role-scoping rule defined yet beyond "org manager."
function buildLinks(churchId: string): WorkforceNavLink[] {
  const cs = (feature: string) => `/workforce/coming-soon?feature=${encodeURIComponent(feature)}`;
  return [
    { label: "Home", href: `/workforce`, icon: Home },
    { label: "Decision Pool", href: `/workforce/decisions?org=${churchId}`, icon: LayoutGrid },
    { label: "My Work", href: cs("My Work"), icon: ClipboardList },
    { label: "Sessions", href: cs("Sessions"), icon: CalendarClock },
    { label: "Attractions", href: cs("Attractions"), icon: Sparkles },
    { label: "Experiences", href: cs("Experiences"), icon: Layers },
    { label: "People & Teams", href: cs("People & Teams"), icon: Users },
    { label: "Evidence & Outcomes", href: cs("Evidence & Outcomes"), icon: FileCheck2 },
    { label: "Vendors", href: cs("Vendors"), icon: Building2, managerOnly: true },
    { label: "Administration", href: cs("Administration"), icon: ShieldCheck, managerOnly: true },
  ];
}

export function WorkforceNav({ churchId, isManager }: { churchId: string; isManager: boolean }) {
  const pathname = usePathname();
  const links = buildLinks(churchId).filter((l) => !l.managerOnly || isManager);

  return (
    <aside className="hidden md:block w-60 shrink-0 border-r border-border-subtle bg-surface/60">
      <nav className="flex flex-col h-full px-2 py-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || (link.href.startsWith(pathname) && pathname !== "/workforce");
          return (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-accent-blue/15 text-[#3f6b06]" : "text-muted hover:text-foreground hover:bg-black/[0.03]"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
