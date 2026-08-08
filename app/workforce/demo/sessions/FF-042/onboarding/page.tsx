import { redirect } from "next/navigation";

// Migrated: this was the Employee waiting-room/onboarding page, now Employee My Session (D1) at
// /my-session/[sessionId]. The distinct Manager-facing Onboarding admin page (C3) lives at
// /manager/sessions/[sessionId]/onboarding -- a genuinely new page, not this one renamed.
export default function LegacyEmployeeOnboardingRedirect() {
  redirect("/workforce/demo/my-session/FF-042");
}
