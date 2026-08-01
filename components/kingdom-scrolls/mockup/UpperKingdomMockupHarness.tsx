"use client";

import "../theme.css";
import { useState } from "react";
import { WorldHud } from "../WorldHud";
import { SeekerPanel } from "../SeekerPanel";
import { InfoPanel } from "../InfoPanel";
import { InventoryTray } from "../InventoryTray";
import { MiniMap } from "../MiniMap";
import { LayerNavigator } from "../LayerNavigator";
import { UpperKingdomMockup } from "./UpperKingdomMockup";
import { gridToScreen } from "./upperKingdomLayout";

// One-off assembled Upper Kingdom mockup for the two-world visual-direction checkpoint. Reuses
// the real HUD components, not redrawn chrome. Not wired into the live route.
export function UpperKingdomMockupHarness() {
  const [seekerCollapsed, setSeekerCollapsed] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [trayCollapsed, setTrayCollapsed] = useState(false);

  const focus = gridToScreen(22, 20);
  const zoom = 0.19;

  return (
    <div className="ks-theme fixed inset-0 flex flex-col bg-[#04060c] overflow-hidden">
      <WorldHud displayName="Coty Elder" avatarUrl={null} level={24} xpTotal={4820} pointsTotal={0} isSignedIn={true} />

      <div className="flex flex-1 min-h-0">
        <SeekerPanel collapsed={seekerCollapsed} onToggle={() => setSeekerCollapsed((v) => !v)} />

        <div className="relative flex-1 min-w-0 overflow-hidden bg-[#04060c] ks-theme">
          <div
            className="absolute"
            style={{ left: "50%", top: "50%", transform: `scale(${zoom}) translate(${-focus.x}px, ${-focus.y}px)`, transformOrigin: "0 0" }}
          >
            <UpperKingdomMockup />
          </div>

          <div className="absolute left-3 bottom-3 z-10">
            <MiniMap camera={{ x: focus.x, y: focus.y, scale: zoom }} level="upper" viewportSizePx={{ width: 1200, height: 800 }} />
          </div>

          <div className="hidden md:block absolute right-3 top-3 z-10">
            <LayerNavigator current="upper" onSelect={() => {}} orientation="vertical" />
          </div>

          {/* World selector -- shown here as a labeled panel; the real component is a future
              implementation step, this demonstrates placement/state per the checkpoint brief. */}
          <div className="ks-panel p-2 w-44" style={{ position: "absolute", right: 12, bottom: 12, zIndex: 10 }}>
            <p className="ks-panel-title mb-1.5">World Selector</p>
            <div className="ks-btn ks-btn-active text-xs px-2 py-1.5 mb-1 w-full justify-start">Upper Kingdom</div>
            <div className="ks-btn text-xs px-2 py-1.5 w-full justify-start opacity-70">Earth — 2026</div>
          </div>

          <div className="ks-viewport-frame" />
        </div>

        <InfoPanel
          collapsed={infoCollapsed}
          onToggle={() => setInfoCollapsed((v) => !v)}
          isSignedIn={true}
          hasChurch={true}
          dailyLesson={{ title: "Call to Follow", scripture: "Matthew 4:19", href: "#", monthLabel: "July · Week 4" }}
        />
      </div>

      <InventoryTray collapsed={trayCollapsed} onToggle={() => setTrayCollapsed((v) => !v)} isSignedIn={true} />
    </div>
  );
}
