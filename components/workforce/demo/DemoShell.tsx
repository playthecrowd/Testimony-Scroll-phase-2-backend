import Link from "next/link";
import { Search, Bell, Coins } from "lucide-react";
import { WorkforceLogo } from "@/components/workforce/WorkforceLogo";
import { RoleSwitcher } from "./RoleSwitcher";
import { WorkforcePageType } from "@/lib/workforcePreviewRole";

// Shell for the offline, mock-data-driven Plotabl Workforce pipeline demo (/workforce/demo/**).
// Deliberately separate from WorkforceAppShell (which requires real Supabase auth/org props) --
// this demo has zero database dependency by design. `pageType` drives the top-right role switcher
// (components/workforce/demo/RoleSwitcher.tsx): it both shows the person representing whichever
// preview role is currently active (persisted across navigation via RoleContext) and computes
// where switching roles should land, per the controlling spec's context-preservation rules.
export function DemoShell({
  pageType,
  searchPlaceholder = "Search Plotabl Workforce…",
  nav,
  navFooter,
  children,
}: {
  pageType: WorkforcePageType;
  searchPlaceholder?: string;
  nav: React.ReactNode;
  navFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
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
          <RoleSwitcher pageType={pageType} />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border-subtle bg-surface/60 p-3">
          <nav className="flex-1 space-y-0.5">{nav}</nav>
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

export function DemoNavItem({ href, label, active, icon: Icon }: { href: string; label: string; active?: boolean; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-accent-blue/15 text-foreground border-l-2 border-accent-blue -ml-0.5 pl-[10px]" : "text-muted hover:text-foreground hover:bg-black/[0.03]"
      }`}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}
