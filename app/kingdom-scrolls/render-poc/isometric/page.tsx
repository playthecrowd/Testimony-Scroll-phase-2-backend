import { IsometricGridPocHarness } from "@/components/kingdom-scrolls/render-poc/IsometricGridPocHarness";

export const dynamic = "force-dynamic";

// Internal test harness -- see IsometricGridPocHarness.tsx's own comment. Not linked from any
// navigation, not part of the real Kingdom Scrolls feature.
export default function IsometricRenderPocPage() {
  return <IsometricGridPocHarness />;
}
