import { UpperKingdomMockupHarness } from "@/components/kingdom-scrolls/mockup/UpperKingdomMockupHarness";

export const dynamic = "force-dynamic";

// Standalone assembled Upper Kingdom mockup for the two-world art-direction checkpoint. Not
// linked from any navigation, not part of the live Kingdom Scrolls route.
export default function UpperKingdomMockupPage() {
  return <UpperKingdomMockupHarness />;
}
