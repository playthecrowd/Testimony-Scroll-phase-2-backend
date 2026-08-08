import { redirect } from "next/navigation";

// Migrated: Session Analytics is now session-scoped under the Manager tree (C8) at
// /manager/sessions/[sessionId]/analytics.
export default function LegacyAnalyticsRedirect() {
  redirect("/workforce/demo/manager/sessions/FF-042/analytics");
}
