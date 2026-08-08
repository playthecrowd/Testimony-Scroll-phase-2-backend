import { redirect } from "next/navigation";

// Migrated: Session Overview is now session-scoped under the Manager tree (C2 in the per-page
// requirements doc), not fixed at /sessions/FF-042/control. Redirect so nothing shared or
// bookmarked to the old URL breaks.
export default function LegacySessionControlRedirect() {
  redirect("/workforce/demo/manager/sessions/FF-042");
}
