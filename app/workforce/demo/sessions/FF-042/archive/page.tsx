import { redirect } from "next/navigation";

// Migrated: Recordings & Archive is now session-scoped under the Manager tree (C9) at
// /manager/sessions/[sessionId]/archive.
export default function LegacyArchiveRedirect() {
  redirect("/workforce/demo/manager/sessions/FF-042/archive");
}
