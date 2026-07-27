"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, LocateFixed, Maximize } from "lucide-react";
import { WorldHud } from "./WorldHud";
import { SeekerPanel } from "./SeekerPanel";
import { InfoPanel, DailyLessonInfo } from "./InfoPanel";
import { InventoryTray } from "./InventoryTray";
import { LayerNavigator } from "./LayerNavigator";
import { MapViewport } from "./MapViewport";
import { useWorldCamera } from "./useWorldCamera";
import { WorldLevel, CAMERA_PRESETS, getPlotCameraTarget, getPlotWorldPosition, clampZoom } from "@/lib/kingdomScrollsWorld";

function getInitialReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface KingdomScrollsWorldProps {
  isSignedIn: boolean;
  profileId: string | null;
  displayName: string;
  avatarUrl: string | null;
  level: number | null;
  xpTotal: number | null;
  pointsTotal: number | null;
  hasChurch: boolean;
  churchName: string | null;
  dailyLesson: DailyLessonInfo | null;
}

export function KingdomScrollsWorld(props: KingdomScrollsWorldProps) {
  const { isSignedIn, profileId, hasChurch, churchName, dailyLesson } = props;
  const router = useRouter();

  const [reducedMotion] = useState(getInitialReducedMotion);
  const [level, setLevel] = useState<WorldLevel>("upper");
  const [seekerCollapsed, setSeekerCollapsed] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [trayCollapsed, setTrayCollapsed] = useState(false);

  const { camera, isFlying, flyTo, onPointerDown, onPointerMove, onPointerUp, onWheel } = useWorldCamera(CAMERA_PRESETS.upper);

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const disabledLevels = hasChurch
    ? undefined
    : { land: "Join a church to unlock", plot: "Join a church to unlock" };

  const goToLevel = useCallback(
    (next: WorldLevel) => {
      setLevel(next);
      if (next === "plot" && profileId) {
        flyTo(getPlotCameraTarget(profileId), reducedMotion);
      } else {
        flyTo(CAMERA_PRESETS[next], reducedMotion);
      }
    },
    [flyTo, profileId, reducedMotion]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    const PAN_STEP = 80;
    // Arrow-key panning: applied directly against camera target for crisp, predictable steps
    // (rather than reusing the drag pan helper, which is tuned for continuous pointer deltas).
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const dx = e.key === "ArrowLeft" ? -PAN_STEP : e.key === "ArrowRight" ? PAN_STEP : 0;
      const dy = e.key === "ArrowUp" ? -PAN_STEP : e.key === "ArrowDown" ? PAN_STEP : 0;
      flyTo({ x: camera.x + dx / camera.scale, y: camera.y + dy / camera.scale, scale: camera.scale }, true);
    } else if (e.key === "+" || e.key === "=") {
      flyTo({ ...camera, scale: clampZoom(camera.scale + 0.15) }, true);
    } else if (e.key === "-" || e.key === "_") {
      flyTo({ ...camera, scale: clampZoom(camera.scale - 0.15) }, true);
    } else if (e.key === "Escape") {
      setSeekerCollapsed(true);
      setInfoCollapsed(true);
    }
  }

  const plot = profileId && hasChurch ? { ...getPlotWorldPosition(profileId), label: isSignedIn ? "My Plot" : "" } : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#04060c] overflow-hidden">
      <WorldHud
        displayName={props.displayName}
        avatarUrl={props.avatarUrl}
        level={props.level}
        xpTotal={props.xpTotal}
        pointsTotal={props.pointsTotal}
        isSignedIn={isSignedIn}
      />

      <div className="flex flex-1 min-h-0">
        <SeekerPanel collapsed={seekerCollapsed} onToggle={() => setSeekerCollapsed((v) => !v)} />

        <div
          className="relative flex-1 min-w-0"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="application"
          aria-label="Kingdom Scrolls world map. Use arrow keys to pan, plus and minus to zoom."
        >
          <MapViewport
            camera={camera}
            isFlying={isFlying}
            churchName={churchName}
            plot={plot}
            currentLessonTitle={dailyLesson?.title ?? null}
            currentLessonHref={dailyLesson?.href ?? null}
            reducedMotion={reducedMotion}
            onSelectLesson={() => dailyLesson && router.push(dailyLesson.href)}
            viewportProps={{
              ref: viewportRef as React.RefObject<HTMLDivElement>,
              onPointerDown,
              onPointerMove,
              onPointerUp,
              onPointerCancel: onPointerUp,
              onWheel,
            }}
          />

          {/* Zoom controls -- bottom-left on desktop, matching the reference screenshots */}
          <div className="absolute left-3 bottom-3 flex flex-col gap-1.5 z-10">
            <button type="button" onClick={() => flyTo({ ...camera, scale: clampZoom(camera.scale + 0.2) }, true)} aria-label="Zoom in" className="qk-card w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:text-accent-blue-light focus-ring">
              <Plus size={16} />
            </button>
            <button type="button" onClick={() => flyTo({ ...camera, scale: clampZoom(camera.scale - 0.2) }, true)} aria-label="Zoom out" className="qk-card w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:text-accent-blue-light focus-ring">
              <Minus size={16} />
            </button>
            <button type="button" onClick={() => goToLevel(level)} aria-label="Center on current level" className="qk-card w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:text-accent-blue-light focus-ring">
              <LocateFixed size={16} />
            </button>
            <button type="button" onClick={() => goToLevel("upper")} aria-label="Fit whole world" className="qk-card w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:text-accent-blue-light focus-ring">
              <Maximize size={16} />
            </button>
          </div>

          {/* Layer navigator -- vertical on desktop (right edge), horizontal bottom-sheet-style
              control on mobile per Section 10's responsive requirement. */}
          <div className="hidden md:block absolute right-3 top-3 z-10">
            <LayerNavigator current={level} onSelect={goToLevel} disabledLevels={disabledLevels} orientation="vertical" />
          </div>
          <div className="md:hidden absolute left-1/2 -translate-x-1/2 bottom-3 z-10">
            <LayerNavigator current={level} onSelect={goToLevel} disabledLevels={disabledLevels} orientation="horizontal" />
          </div>
        </div>

        <InfoPanel
          collapsed={infoCollapsed}
          onToggle={() => setInfoCollapsed((v) => !v)}
          isSignedIn={isSignedIn}
          hasChurch={hasChurch}
          dailyLesson={dailyLesson}
        />
      </div>

      <InventoryTray collapsed={trayCollapsed} onToggle={() => setTrayCollapsed((v) => !v)} isSignedIn={isSignedIn} />
    </div>
  );
}
