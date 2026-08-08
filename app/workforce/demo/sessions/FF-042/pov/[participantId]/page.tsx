import { redirect } from "next/navigation";

// Migrated to /my-session/[sessionId]/pov/[participantId] (D4), preserving the participant id.
export default async function LegacyPovRedirect({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  redirect(`/workforce/demo/my-session/FF-042/pov/${participantId}`);
}
