import { redirect } from "next/navigation";

// /capture is preserved for compatibility (old links/bookmarks) but /experience-builder is now
// the canonical Host-facing route -- see components/layout/{Sidebar,TopBar}.tsx and proxy.ts,
// which protect both paths.
export default function CapturePage() {
  redirect("/experience-builder");
}
