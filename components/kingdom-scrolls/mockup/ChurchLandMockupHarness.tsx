"use client";

import "../theme.css";
import { useState } from "react";
import { WorldHud } from "../WorldHud";
import { SeekerPanel } from "../SeekerPanel";
import { InfoPanel } from "../InfoPanel";
import { InventoryTray } from "../InventoryTray";
import { MiniMap } from "../MiniMap";
import { LayerNavigator } from "../LayerNavigator";
import { ChurchLandMockup } from "./ChurchLandMockup";
import { gridToScreen } from "./churchLandLayout";

// One-off assembled Church Land mockup for the Earth Lands visual-direction approval checkpoint.
// Uses the REAL, already-shipped HUD components (WorldHud/SeekerPanel/InfoPanel/InventoryTray/
// MiniMap/LayerNavigator) -- not redrawn fake chrome -- wrapped around the officially generated
// Earth Lands assets placed on the same isometric grid math as the render-poc. Not wired into the
// live Kingdom Scrolls route; this is a standalone screenshot target only.
export function ChurchLandMockupHarness() {
  const [seekerCollapsed, setSeekerCollapsed] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [trayCollapsed, setTrayCollapsed] = useState(false);

  // Frame the camera to show the whole property in one shot: civic buildings north, member
  // district south, matching the composition the brief asks for.
  const focus = gridToScreen(16, 13);
  const zoom = 0.37;

  return (
    <div className="ks-theme fixed inset-0 flex flex-col bg-[#04060c] overflow-hidden">
      <WorldHud displayName="Coty Elder" avatarUrl={null} level={24} xpTotal={4820} pointsTotal={0} isSignedIn={true} />

      <div className="flex flex-1 min-h-0">
        <SeekerPanel collapsed={seekerCollapsed} onToggle={() => setSeekerCollapsed((v) => !v)} />

        <div className="relative flex-1 min-w-0 overflow-hidden bg-[#04060c] ks-theme">
          <div
            className="absolute"
            style={{
              left: "50%",
              top: "50%",
              transform: `scale(${zoom}) translate(${-focus.x}px, ${-focus.y}px)`,
              transformOrigin: "0 0",
            }}
          >
            <ChurchLandMockup />
          </div>

          <div className="absolute left-3 bottom-3 z-10">
            <MiniMap camera={{ x: focus.x, y: focus.y, scale: zoom }} level="land" viewportSizePx={{ width: 1200, height: 800 }} />
          </div>

          <div className="hidden md:block absolute right-3 top-3 z-10">
            <LayerNavigator current="land" onSelect={() => {}} orientation="vertical" />
          </div>

          <div className="ks-viewport-frame" />
        </div>

        <InfoPanel
          collapsed={infoCollapsed}
          onToggle={() => setInfoCollapsed((v) => !v)}
          isSignedIn={true}
          hasChurch={true}
          dailyLesson={{ title: "Unity in Purpose", scripture: "Ephesians 4:3", href: "#", monthLabel: "July · Week 4" }}
        />
      </div>

      <InventoryTray collapsed={trayCollapsed} onToggle={() => setTrayCollapsed((v) => !v)} isSignedIn={true} />
    </div>
  );
}
