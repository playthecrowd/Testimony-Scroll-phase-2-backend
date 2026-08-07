"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { useSession } from "@/context/SessionContext";

const BARE_ROUTES = ["/login", "/signup", "/workforce"];
// Prefix match with a trailing slash, not exact and not a bare "/kingdom-scrolls" -- the
// full-screen-HUD routes under this prefix (Inventory Land, the world-map mockup/render-poc
// pages) own their own chrome (top bar, side panels, layer navigator) and must never be boxed in
// by the standard TopBar/Sidebar. The bare route "/kingdom-scrolls" itself is deliberately
// EXCLUDED from this prefix: it is the Trailer/Introduction Gateway, an ordinary content page
// (lesson list, progress card, sidebars) meant to sit inside normal site chrome exactly like any
// other page, not a full-viewport HUD.
//
// "/workforce/" (unlike kingdom-scrolls) is unconditionally bare, including its own root
// "/workforce" (added to BARE_ROUTES above) -- Plotabl Workforce is a distinct sibling module with
// its own visible application shell (wordmark, nav, bright warm-white theme), never Q4K's
// TopBar/Sidebar/dark theme. See app/workforce/layout.tsx for the shell Workforce provides
// instead.
const BARE_ROUTE_PREFIXES = ["/kingdom-scrolls/", "/workforce/"];

export function PageShell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const showSidebar = ready && session.isLoggedIn;

  if (BARE_ROUTES.includes(pathname) || BARE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return <main className="flex-1 min-w-0">{children}</main>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar onMenuClick={showSidebar ? () => setMobileOpen(true) : undefined} />
      <div className="flex flex-1">
        {showSidebar && <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
