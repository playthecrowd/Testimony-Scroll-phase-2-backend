import { redirect } from "next/navigation";

// Migrated: Employee Participants & POV (D3) now lives at /my-session/[sessionId]/participants-pov,
// distinct from the Manager's own Participants admin page (C4) at
// /manager/sessions/[sessionId]/participants.
export default function LegacyParticipantsRedirect() {
  redirect("/workforce/demo/my-session/FF-042/participants-pov");
}
