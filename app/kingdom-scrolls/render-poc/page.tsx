import { RenderPocHarness } from "@/components/kingdom-scrolls/render-poc/RenderPocHarness";

export const dynamic = "force-dynamic";

// Internal test harness for the rendering-technology proof of concept -- see
// components/kingdom-scrolls/render-poc/RenderPocHarness.tsx's own comment. Not linked from any
// navigation, not part of the real Kingdom Scrolls feature.
export default function RenderPocPage() {
  return <RenderPocHarness />;
}
