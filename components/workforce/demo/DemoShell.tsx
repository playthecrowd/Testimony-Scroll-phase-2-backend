"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Coins } from "lucide-react";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { RoleSwitcher } from "./RoleSwitcher";
import { WorkforcePageType, WorkforceNavContext, DEFAULT_NAV_CONTEXT } from "@/lib/workforcePreviewRole";
import { ROLE_NAV } from "@/lib/workforceNav";
import { useWorkforcePreviewRole } from "./RoleContext";

// Shell for the offline, mock-data-driven Plotabl Workforce pipeline demo (/workforce/demo/**).
// Deliberately separate from WorkforceAppShell (which requires real Supabase auth/org props) --
// this demo has zero database dependency by design. Nav is computed here from the active preview
// role (lib/workforceNav.ts's ROLE_NAV), not passed in by each page -- that's the fix for tabs
// drifting into pointing at unrelated pages: there is now exactly one place a role's tab list can
// be defined. `pageType` still drives the top-right role switcher's context-preserving
// destination logic (lib/workforcePreviewRole.ts).
export function DemoShell({
  pageType,
  navContext = DEFAULT_NAV_CONTEXT,
  searchPlaceholder = "Search Plotabl Workforce…",
  navFooter,
  children,
}: {
  pageType: WorkforcePageType;
  navContext?: WorkforceNavContext;
  searchPlaceholder?: string;
  navFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { role } = useWorkforcePreviewRole();
  const pathname = usePathname();
  const items = ROLE_NAV[role];

  return (
    <div className="wf-theme min-h-screen flex flex-col bg-background">
      <header className="flex items-center gap-4 px-4 md:px-6 h-16 border-b border-border-subtle bg-surface/80 shrink-0">
        <WorkforceLogo href="/workforce/demo" />
        <div className="hidden sm:flex items-center flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              placeholder={searchPlaceholder}
              disabled
              className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm focus-ring"
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-black/[0.03] text-muted focus-ring" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-accent-gold bg-accent-gold/10 border border-accent-gold/30 rounded-full px-3 py-1.5">
            <Coins size={13} /> 1,250 credits
          </div>
          <RoleSwitcher pageType={pageType} navContext={navContext} />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border-subtle bg-surface/60 p-3">
          <nav className="flex-1 space-y-0.5">
            {items.map((item) => {
              const href = item.href(navContext);
              const active = pathname === href;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-accent-blue/15 text-foreground border-l-2 border-accent-blue -ml-0.5 pl-[10px]" : "text-muted hover:text-foreground hover:bg-black/[0.03]"
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {navFooter}
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <footer className="px-6 py-2 border-t border-border-subtle text-[11px] text-muted flex items-center justify-between bg-[#1b2a4a] text-white/70">
        <span>Plotabl Workforce • Concept</span>
        <span>Unclassified Training Demo</span>
      </footer>
    </div>
  );
}
