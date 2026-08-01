"use client";

import "../theme.css";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { WorldHud } from "../WorldHud";
import { useWorldCamera } from "../useWorldCamera";
import { CameraTarget, clampZoom } from "@/lib/kingdomScrollsWorld";
import { MemberPlotSlice, Ghost, RoadGhost } from "../mockup/memberPlotSlice/MemberPlotSlice";
import {
  gridToScreen,
  screenToGrid,
  isInCore,
  CORE_COL_START,
  CORE_ROW_START,
  CORE_SIZE,
  FIXED_OBJECTS,
  PATH_CELLS,
  computeCoverMinZoom,
  computeXYBoundsAtScale,
} from "../mockup/memberPlotSlice/memberPlotSliceLayout";
import { useInventoryLandPlacements, Rotation } from "./useInventoryLandPlacements";
import { PLACEABLE_CATALOG } from "../mockup/memberPlotSlice/placeableCatalog";
import { useInventoryLandRoads } from "./useInventoryLandRoads";
import { RoadTileSvg } from "../mockup/memberPlotSlice/RoadTileSvg";
import { SheetState } from "../mockup/memberPlotSlice/BottomSheet";
import { ROAD_PREVIEW_MASKS_FOR_PICKER } from "../mockup/memberPlotSlice/roadPreviewMasks";
import { MobileMemberPlotControls } from "../mockup/memberPlotSlice/MobileMemberPlotControls";

// Production Inventory Land -- refactored from the Member Plot Slice prototype
// (components/kingdom-scrolls/mockup/memberPlotSlice/MemberPlotSliceHarness.tsx), which is left
// completely untouched. Every pure/presentational module (MemberPlotSlice, layout math, road
// system, catalog, mobile controls, bottom sheet) is reused directly -- none of it has
// prototype-specific mock data baked in. Only three things differ from the prototype: (1) real
// signed-in profile data drives the WorldHud instead of a hard-coded "Coty Elder" fixture, (2)
// placement/road persistence is profile-scoped (useInventoryLandPlacements/useInventoryLandRoads)
// instead of one flat global localStorage key, and (3) the Seeker Inventory sidebar copy is framed
// as a beta preview of real production, not a development fixture.
const MOBILE_BREAKPOINT = 768;

function blockedCellKeys(): Set<string> {
  const set = new Set<string>();
  for (const o of FIXED_OBJECTS) set.add(`${o.col},${o.row}`);
  for (const c of PATH_CELLS) set.add(`${c.col},${c.row}`);
  return set;
}

export function InventoryLandHarness({
  profileId,
  displayName,
  avatarUrl,
  level,
  xpTotal,
  pointsTotal,
  dailyLessonTitle,
  dailyLessonScripture,
  dailyLessonHref,
}: {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number | null;
  xpTotal: number | null;
  pointsTotal: number | null;
  dailyLessonTitle: string | null;
  dailyLessonScripture: string | null;
  dailyLessonHref: string | null;
}) {
  const coreCenter = useMemo(() => gridToScreen(CORE_COL_START + CORE_SIZE / 2, CORE_ROW_START + CORE_SIZE / 2), []);
  const PREFERRED_MAX_ZOOM = 1.1;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setViewportSize({ w: rect.width, h: rect.height });
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    const onWindowResize = () => {
      const r = viewportRef.current?.getBoundingClientRect();
      if (r) setViewportSize({ w: r.width, h: r.height });
    };
    window.addEventListener("resize", onWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  const [windowWidth, setWindowWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobileLayout = windowWidth !== null && windowWidth < MOBILE_BREAKPOINT;

  const { placements, place, moveExisting, remove } = useInventoryLandPlacements(profileId);
  const { roads, placeRoad, removeRoad } = useInventoryLandRoads(profileId);

  const [buildMode, setBuildMode] = useState(false);
  const [selectedPlaceableId, setSelectedPlaceableId] = useState<string | null>(null);
  const [movingInstanceId, setMovingInstanceId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [roadToolActive, setRoadToolActive] = useState(false);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [inventorySheetState, setInventorySheetState] = useState<SheetState>("closed");
  const [lessonSheetState, setLessonSheetState] = useState<SheetState>("closed");

  const activeAssetId = selectedPlaceableId ?? placements.find((p) => p.instanceId === movingInstanceId)?.assetId ?? null;
  const isBuildToolActive = buildMode && (roadToolActive || !!activeAssetId);

  const rawMinZoom = viewportSize ? computeCoverMinZoom(viewportSize.w, viewportSize.h) : PREFERRED_MAX_ZOOM;
  const minZoom = clampZoom(rawMinZoom);
  const maxZoom = Math.max(PREFERRED_MAX_ZOOM, minZoom);
  const initialCamera: CameraTarget = { x: coreCenter.x, y: coreCenter.y, scale: minZoom };

  const bounds = useMemo(() => {
    if (!viewportSize) {
      return { minX: coreCenter.x, maxX: coreCenter.x, minY: coreCenter.y, maxY: coreCenter.y, minZoom, maxZoom };
    }
    const vw = viewportSize.w;
    const vh = viewportSize.h;
    return { minZoom, maxZoom, getXYBounds: (scale: number) => computeXYBoundsAtScale(scale, vw, vh) };
  }, [viewportSize, coreCenter, minZoom, maxZoom]);
  const {
    camera,
    onPointerDown,
    onPointerMove: cameraPointerMove,
    onPointerUp,
    onWheel: cameraWheel,
    flyTo,
    zoomAt,
  } = useWorldCamera(initialCamera, bounds, { panEnabled: !isBuildToolActive });

  const didSetInitialFramingRef = useRef(false);
  useEffect(() => {
    if (viewportSize && !didSetInitialFramingRef.current) {
      didSetInitialFramingRef.current = true;
      flyTo({ x: coreCenter.x, y: coreCenter.y, scale: minZoom }, true);
    }
  }, [viewportSize, coreCenter, minZoom, flyTo]);

  const isAtMinZoom = camera.scale <= minZoom + 1e-6;
  const isAtMaxZoom = camera.scale >= maxZoom - 1e-6;

  function resetCamera() {
    flyTo({ x: coreCenter.x, y: coreCenter.y, scale: minZoom }, false);
  }

  const blocked = useMemo(() => blockedCellKeys(), []);

  const isValidCell = useCallback(
    (col: number, row: number, excludeInstanceId: string | null) => {
      if (!isInCore(col, row)) return false;
      if (blocked.has(`${col},${row}`)) return false;
      const occupied = placements.some((p) => p.col === col && p.row === row && p.instanceId !== excludeInstanceId);
      if (occupied) return false;
      const roadOccupied = roads.some((r) => r.col === col && r.row === row);
      if (roadOccupied) return false;
      return true;
    },
    [blocked, placements, roads]
  );

  const isValidRoadCell = useCallback(
    (col: number, row: number) => {
      if (!isInCore(col, row)) return false;
      if (blocked.has(`${col},${row}`)) return false;
      const occupied = placements.some((p) => p.col === col && p.row === row);
      if (occupied) return false;
      return true;
    },
    [blocked, placements]
  );

  const screenToCell = useCallback(
    (clientX: number, clientY: number) => {
      const el = viewportRef.current;
      if (!el) return null;
      return screenToGrid(clientX, clientY, el.getBoundingClientRect(), camera);
    },
    [camera]
  );

  const ghost: Ghost | null =
    buildMode && !roadToolActive && activeAssetId && hoverCell
      ? { assetId: activeAssetId, col: hoverCell.col, row: hoverCell.row, rotation, valid: isValidCell(hoverCell.col, hoverCell.row, movingInstanceId) }
      : null;

  const hoverCellHasRoad = hoverCell ? roads.some((r) => r.col === hoverCell.col && r.row === hoverCell.row) : false;
  const roadGhost: RoadGhost | null =
    buildMode && roadToolActive && hoverCell && !hoverCellHasRoad
      ? { col: hoverCell.col, row: hoverCell.row, valid: isValidRoadCell(hoverCell.col, hoverCell.row) }
      : null;

  const selectedRoad = selectedRoadId ? roads.find((r) => r.placementId === selectedRoadId) ?? null : null;

  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureMovedRef = useRef(false);
  const GESTURE_MOVE_THRESHOLD_PX = 8;

  function handleViewportPointerDown(e: React.PointerEvent) {
    onPointerDown(e);
    gestureStartRef.current = { x: e.clientX, y: e.clientY };
    gestureMovedRef.current = false;
  }

  function handlePointerMove(e: React.PointerEvent) {
    cameraPointerMove(e);
    if (buildMode) setHoverCell(screenToCell(e.clientX, e.clientY));
    const start = gestureStartRef.current;
    if (start && !gestureMovedRef.current) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > GESTURE_MOVE_THRESHOLD_PX) gestureMovedRef.current = true;
    }
  }

  function commitRelicPlacement(cell: { col: number; row: number }) {
    if (!isValidCell(cell.col, cell.row, movingInstanceId)) return;
    if (movingInstanceId) {
      moveExisting(movingInstanceId, cell.col, cell.row, rotation);
      setMovingInstanceId(null);
    } else if (selectedPlaceableId) {
      place(selectedPlaceableId, cell.col, cell.row, rotation);
    }
    setSelectedPlaceableId(null);
    setRotation(0);
    setHoverCell(null);
  }

  function removeMovingPlacement() {
    if (!movingInstanceId) return;
    remove(movingInstanceId);
    setMovingInstanceId(null);
    setHoverCell(null);
  }

  function handleClick(e: React.MouseEvent) {
    if (!buildMode) return;
    const cell = screenToCell(e.clientX, e.clientY);
    if (!cell) return;

    if (roadToolActive) {
      const existing = roads.find((r) => r.col === cell.col && r.row === cell.row);
      if (existing) {
        setSelectedRoadId((cur) => (cur === existing.placementId ? null : existing.placementId));
        return;
      }
      if (selectedRoadId) setSelectedRoadId(null);
      if (isValidRoadCell(cell.col, cell.row)) placeRoad(cell.col, cell.row);
      return;
    }

    if (!activeAssetId) return;
    if (isMobileLayout) {
      const isRepeatTapOnLockedCell = !gestureMovedRef.current && hoverCell && hoverCell.col === cell.col && hoverCell.row === cell.row;
      if (isRepeatTapOnLockedCell) {
        commitRelicPlacement(cell);
      } else {
        setHoverCell(cell);
      }
      return;
    }
    commitRelicPlacement(cell);
  }

  function handleExistingObjectClick(instanceId: string) {
    if (!buildMode) return;
    setSelectedPlaceableId(null);
    setMovingInstanceId(instanceId);
    setHoverCell(null);
  }

  function selectPlaceable(assetId: string) {
    setMovingInstanceId(null);
    setRoadToolActive(false);
    setSelectedRoadId(null);
    setHoverCell(null);
    setSelectedPlaceableId((cur) => (cur === assetId ? null : assetId));
    if (isMobileLayout) setInventorySheetState("closed");
  }

  function toggleRoadTool() {
    setSelectedPlaceableId(null);
    setMovingInstanceId(null);
    setSelectedRoadId(null);
    setRoadToolActive((v) => !v);
    if (isMobileLayout) setInventorySheetState("closed");
  }

  function removeSelectedRoad() {
    if (!selectedRoad) return;
    removeRoad(selectedRoad.col, selectedRoad.row);
    setSelectedRoadId(null);
  }

  function cancelPlacement() {
    setSelectedPlaceableId(null);
    setMovingInstanceId(null);
    setSelectedRoadId(null);
    setRotation(0);
    setHoverCell(null);
  }

  function rotateGhost() {
    setRotation((r) => ((r + 90) % 360) as Rotation);
  }

  function toggleBuildMode() {
    setBuildMode((v) => {
      if (v) {
        cancelPlacement();
        setRoadToolActive(false);
      }
      return !v;
    });
  }

  return (
    <div
      className="ks-theme fixed inset-0 flex flex-col bg-[#04060c] overflow-hidden"
      onKeyDown={(e) => {
        if (e.key.toLowerCase() === "r" && ghost) rotateGhost();
        if (e.key === "Escape") cancelPlacement();
      }}
      tabIndex={-1}
    >
      <WorldHud displayName={displayName} avatarUrl={avatarUrl} level={level} xpTotal={xpTotal} pointsTotal={pointsTotal} isSignedIn={true} />

      <div className="flex flex-1 min-h-0">
        <div
          ref={viewportRef}
          className="relative flex-1 min-w-0 overflow-hidden bg-[#04060c] ks-theme touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={cameraWheel}
          onClick={handleClick}
        >
          <div
            className="absolute"
            style={{ left: "50%", top: "50%", transform: `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`, transformOrigin: "0 0" }}
          >
            <MemberPlotSlice showGrid={buildMode} placements={placements} ghost={ghost} selectedInstanceId={movingInstanceId} roads={roads} roadGhost={roadGhost} />
            {buildMode &&
              !roadToolActive &&
              placements.map((p) => {
                const { x, y } = gridToScreen(p.col, p.row);
                return (
                  <button
                    key={p.instanceId}
                    type="button"
                    aria-label={`Move ${p.assetId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExistingObjectClick(p.instanceId);
                    }}
                    style={{ position: "absolute", left: x - 24, top: y - 48, width: 48, height: 48, zIndex: 30000, background: "transparent", border: "none", cursor: "pointer" }}
                  />
                );
              })}
          </div>

          <div className="ks-viewport-frame" />

          <Link
            href="/kingdom-scrolls"
            className="ks-btn absolute left-3 top-3 z-10 px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Kingdom Scrolls Gateway
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleBuildMode();
            }}
            className={`ks-btn absolute right-3 top-3 z-10 px-4 py-2 text-sm font-semibold ${buildMode ? "ks-btn-active" : ""}`}
          >
            {buildMode ? "Exit Build Mode" : "Build"}
          </button>

          {!isMobileLayout && buildMode && (movingInstanceId || selectedPlaceableId) && (
            <div className="ks-panel absolute left-3 top-14 z-10 p-3 flex items-center gap-3">
              <span className="text-xs" style={{ color: "var(--ks-text-dim)" }}>
                {movingInstanceId ? "Moving item" : "Placing item"} -- click a highlighted cell to confirm
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  rotateGhost();
                }}
                className="ks-btn text-xs px-2 py-1"
              >
                Rotate (R)
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelPlacement();
                }}
                className="ks-btn text-xs px-2 py-1"
              >
                Cancel (Esc)
              </button>
            </div>
          )}

          {!isMobileLayout && buildMode && roadToolActive && !selectedRoad && (
            <div className="ks-panel absolute left-3 top-14 z-10 p-3">
              <span className="text-xs" style={{ color: "var(--ks-text-dim)" }}>
                Road tool active -- click an empty cell to place a connected road segment, or click an existing road to edit it.
              </span>
            </div>
          )}

          {!isMobileLayout && buildMode && selectedRoad && (
            <div className="ks-panel absolute left-3 top-14 z-10 p-3 flex items-center gap-3">
              <span className="text-xs" style={{ color: "var(--ks-text-dim)" }}>
                Road segment selected -- its shape is always connection-derived, not manually chosen.
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSelectedRoad();
                }}
                className="ks-btn text-xs px-2 py-1"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelPlacement();
                }}
                className="ks-btn text-xs px-2 py-1"
              >
                Done (Esc)
              </button>
            </div>
          )}

          <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomAt(0.15);
              }}
              disabled={isAtMaxZoom}
              aria-label="Zoom in"
              className="ks-btn flex items-center justify-center text-lg font-bold leading-none disabled:opacity-40"
              style={isMobileLayout ? { width: 44, height: 44 } : { width: 36, height: 36 }}
            >
              +
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomAt(-0.15);
              }}
              disabled={isAtMinZoom}
              aria-label="Zoom out"
              className="ks-btn flex items-center justify-center text-lg font-bold leading-none disabled:opacity-40"
              style={isMobileLayout ? { width: 44, height: 44 } : { width: 36, height: 36 }}
            >
              &minus;
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetCamera();
              }}
              aria-label="Reset camera"
              className="ks-btn px-1.5 text-[10px] font-semibold"
              style={isMobileLayout ? { minHeight: 44 } : undefined}
            >
              Reset View
            </button>
          </div>
        </div>

        {!isMobileLayout && (
        <aside className="ks-dock-panel flex flex-col border-l w-64 shrink-0">
          <div className="p-3" style={{ borderBottom: "1px solid var(--ks-bronze-dim)" }}>
            <span className="ks-panel-title">Seeker Inventory</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto qk-scrollbar">
            <p className="text-[10px] mb-3" style={{ color: "var(--ks-text-dim)" }}>
              Beta preview -- these are your 6 starter items. The full reward catalog and real item
              ownership are coming in a future update. {buildMode ? "Select one, then click a green cell to place it." : "Enter Build mode to place these on your land."}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PLACEABLE_CATALOG.map((item) => (
                <button
                  key={item.assetId}
                  type="button"
                  disabled={!buildMode}
                  onClick={() => selectPlaceable(item.assetId)}
                  className={`ks-panel p-2 flex flex-col items-center gap-1 ${selectedPlaceableId === item.assetId ? "ks-btn-active" : ""} disabled:opacity-40`}
                  title={item.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.assetPath} alt="" className="w-10 h-10 object-contain" />
                  <span className="text-[9px] text-center leading-tight" style={{ color: "var(--ks-text-dim)" }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4" style={{ borderTop: "1px solid var(--ks-bronze-dim)" }}>
            <p className="ks-panel-title mb-2">Road Building</p>
            <p className="text-[10px] mb-3" style={{ color: "var(--ks-text-dim)" }}>
              Modern 2026 road family -- placement auto-connects to neighboring road cells.
            </p>
            <div className="grid grid-cols-5 gap-1 mb-3">
              {ROAD_PREVIEW_MASKS_FOR_PICKER.map((mask, i) => (
                <RoadTileSvg key={i} mask={mask} width={44} height={22} />
              ))}
            </div>
            <button
              type="button"
              disabled={!buildMode}
              onClick={toggleRoadTool}
              className={`ks-btn w-full text-xs px-3 py-1.5 ${roadToolActive ? "ks-btn-active" : ""} disabled:opacity-40`}
            >
              {roadToolActive ? "Exit Road Tool" : "Build Roads"}
            </button>
          </div>

          {dailyLessonTitle && (
            <div className="p-4" style={{ borderTop: "1px solid var(--ks-bronze-dim)" }}>
              <p className="ks-panel-title mb-2">Daily Lesson Pavilion</p>
              <div className="ks-panel p-3">
                <p className="text-sm font-bold" style={{ color: "var(--ks-text)" }}>
                  {dailyLessonTitle}
                </p>
                {dailyLessonScripture && (
                  <p className="text-xs mt-1" style={{ color: "var(--ks-text-dim)" }}>
                    {dailyLessonScripture}
                  </p>
                )}
                {dailyLessonHref && (
                  <a href={dailyLessonHref} className="ks-btn text-xs px-3 py-1.5 mt-3 w-full block text-center">
                    Begin Lesson
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
        )}
      </div>

      {isMobileLayout && (
        <MobileMemberPlotControls
          buildMode={buildMode}
          roadToolActive={roadToolActive}
          selectedRoad={selectedRoad}
          selectedPlaceableId={selectedPlaceableId}
          movingInstanceId={movingInstanceId}
          hoverCell={hoverCell}
          isValidCell={isValidCell}
          rotation={rotation}
          onRotate={rotateGhost}
          onConfirmPlacement={() => hoverCell && commitRelicPlacement(hoverCell)}
          onCancel={cancelPlacement}
          onRemoveMoving={removeMovingPlacement}
          onRemoveRoad={removeSelectedRoad}
          onCancelRoad={() => setSelectedRoadId(null)}
          activeAssetLabel={PLACEABLE_CATALOG.find((p) => p.assetId === activeAssetId)?.label ?? null}
          inventorySheetState={inventorySheetState}
          setInventorySheetState={setInventorySheetState}
          lessonSheetState={lessonSheetState}
          setLessonSheetState={setLessonSheetState}
          selectedPlaceable={selectedPlaceableId}
          onSelectPlaceable={selectPlaceable}
          onToggleRoadTool={toggleRoadTool}
          dailyLessonTitle={dailyLessonTitle}
          dailyLessonScripture={dailyLessonScripture}
          dailyLessonHref={dailyLessonHref}
          inventoryDescription="Beta preview -- these are your 6 starter items. The full reward catalog and real item ownership are coming in a future update."
        />
      )}
    </div>
  );
}
