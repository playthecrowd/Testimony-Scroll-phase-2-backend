"use client";

import Link from "next/link";
import { Search, Bell } from "lucide-react";
import { WorkforceLogo } from "./WorkforceLogo";
import { WorkforceNav } from "./WorkforceNav";

// The authenticated Workforce application shell -- header (wordmark, search, notifications,
// identity + role badge) plus the module-level side nav (WorkforceNav), wrapping every
// authenticated Workforce page's content. Presentational only: every page that uses this already
// did its own server-side auth/entitlement fetch (matching this codebase's per-page guard
// convention) and passes the resolved values in as props, rather than this component re-fetching
// them itself.
export function WorkforceAppShell({
  churchId,
  orgName,
  userName,
  roleLabel,
  isManager,
  children,
}: {
  churchId: string;
  orgName: string;
  userName: string;
  roleLabel: string;
  isManager: boolean;
  children: React.ReactNode;
}) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-4 px-4 md:px-6 h-16 border-b border-border-subtle bg-surface/80 shrink-0">
        <WorkforceLogo />
        <div className="hidden sm:flex items-center flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              placeholder="Search decisions, people, experiences..."
              className="w-full bg-surface-2 border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm focus-ring"
              disabled
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden md:inline text-xs text-muted truncate max-w-[160px]">{orgName}</span>
          <button className="p-2 rounded-lg hover:bg-black/[0.03] text-muted focus-ring" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent-purple text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {initials || "?"}
            </span>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-medium text-foreground">{userName}</div>
              <div className="text-[11px] text-accent-gold font-medium">{roleLabel}</div>
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <WorkforceNav churchId={churchId} isManager={isManager} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <footer className="px-6 py-3 border-t border-border-subtle text-[11px] text-muted flex items-center justify-between">
        <span>Plotabl Workforce</span>
        <Link href="/dashboard" className="hover:text-foreground">
          Back to Quest for the Kingdom
        </Link>
      </footer>
    </div>
  );
}
