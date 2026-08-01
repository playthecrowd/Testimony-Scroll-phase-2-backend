"use client";

import "../theme.css";
import { useState } from "react";
import { WorldHud } from "../WorldHud";
import { SeekerPanel } from "../SeekerPanel";
import { InfoPanel } from "../InfoPanel";
import { InventoryTray } from "../InventoryTray";
import { MiniMap } from "../MiniMap";
import { LayerNavigator } from "../LayerNavigator";
import { EarthWorld2026Mockup } from "./EarthWorld2026Mockup";
import { gridToScreen } from "./earthWorld2026Layout";

export function EarthWorld2026MockupHarness() {
  const [seekerCollapsed, setSeekerCollapsed] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [trayCollapsed, setTrayCollapsed] = useState(false);

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
            style={{ left: "50%", top: "50%", transform: `scale(${zoom}) translate(${-focus.x}px, ${-focus.y}px)`, transformOrigin: "0 0" }}
          >
            <EarthWorld2026Mockup />
          </div>

          <div className="absolute left-3 bottom-3 z-10">
            <MiniMap camera={{ x: focus.x, y: focus.y, scale: zoom }} level="land" viewportSizePx={{ width: 1200, height: 800 }} />
          </div>

          <div className="hidden md:block absolute right-3 top-3 z-10">
            <LayerNavigator current="land" onSelect={() => {}} orientation="vertical" />
          </div>

          <div className="ks-panel p-2 w-44" style={{ position: "absolute", right: 12, bottom: 12, zIndex: 10 }}>
            <p className="ks-panel-title mb-1.5">World Selector</p>
            <div className="ks-btn text-xs px-2 py-1.5 mb-1 w-full justify-start opacity-70">Upper Kingdom</div>
            <div className="ks-btn ks-btn-active text-xs px-2 py-1.5 w-full justify-start">Earth — 2026</div>
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
