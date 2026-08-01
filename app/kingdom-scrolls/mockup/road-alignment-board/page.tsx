import { RoadAlignmentBoard } from "@/components/kingdom-scrolls/mockup/roadAlignmentBoard/RoadAlignmentBoard";

export const dynamic = "force-dynamic";

// Standalone road alignment test board -- required checkpoint before the corrected road family is
// reintegrated into the Member Plot. Not linked from navigation, no live-app wiring.
export default function RoadAlignmentBoardPage() {
  return <RoadAlignmentBoard />;
}
