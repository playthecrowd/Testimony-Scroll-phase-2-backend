import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plotabl Workforce",
  description: "Move every decision from intent to understanding, action, and measurable outcomes.",
};

// Applies the Workforce theme (app/globals.css' .wf-theme block) to every route under /workforce.
// PageShell (components/layout/PageShell.tsx) already excludes this entire path from Q4K's own
// TopBar/Sidebar -- Workforce provides its own shell instead (see components/workforce/AppShell.tsx
// for the authenticated header+nav, and app/workforce/page.tsx for the public homepage's own header).
export default function WorkforceLayout({ children }: { children: React.ReactNode }) {
  return <div className="wf-theme min-h-screen">{children}</div>;
}
