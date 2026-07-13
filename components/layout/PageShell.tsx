"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { useSession } from "@/context/SessionContext";

const BARE_ROUTES = ["/login", "/signup"];

export function PageShell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const showSidebar = ready && session.isLoggedIn;

  if (BARE_ROUTES.includes(pathname)) {
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
