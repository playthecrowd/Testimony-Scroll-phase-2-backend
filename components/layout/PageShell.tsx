"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { useSession } from "@/context/SessionContext";

const BARE_ROUTES = ["/login", "/signup"];
// Prefix match with a trailing slash, not exact and not a bare "/kingdom-scrolls" -- the
// full-screen-HUD routes under this prefix (Inventory Land, the world-map mockup/render-poc
// pages) own their own chrome (top bar, side panels, layer navigator) and must never be boxed in
// by the standard TopBar/Sidebar. The bare route "/kingdom-scrolls" itself is deliberately
// EXCLUDED from this prefix: it is the Trailer/Introduction Gateway, an ordinary content page
// (lesson list, progress card, sidebars) meant to sit inside normal site chrome exactly like any
// other page, not a full-viewport HUD.
const BARE_ROUTE_PREFIXES = ["/kingdom-scrolls/"];

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
