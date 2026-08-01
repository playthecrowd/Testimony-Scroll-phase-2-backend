"use client";

import "../../theme.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorldHud } from "../../WorldHud";
import { useWorldCamera } from "../../useWorldCamera";
import { CameraTarget, clampZoom } from "@/lib/kingdomScrollsWorld";
import { MemberPlotSlice, Ghost, RoadGhost } from "./MemberPlotSlice";
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
} from "./memberPlotSliceLayout";
import { usePlotPlacements, Rotation } from "./usePlotPlacements";
import { PLACEABLE_CATALOG } from "./placeableCatalog";
import { useRoadPlacements } from "./useRoadPlacements";
import { RoadTileSvg } from "./RoadTileSvg";
import { SheetState } from "./BottomSheet";
import { ROAD_PREVIEW_MASKS_FOR_PICKER } from "./roadPreviewMasks";
import { MobileMemberPlotControls } from "./MobileMemberPlotControls";

// Matches Tailwind's `md` breakpoint (768px), the same threshold the desktop sidebar's own
// `hidden md:flex` already uses -- below this, that sidebar is invisible and inaccessible, which is
// exactly the mobile blocker this threshold's mobile-only UI (persistent buttons, bottom sheets,
// placement toolbar) exists to fix. Tracked via window.innerWidth directly, not the map viewport's
// own measured width, because the map viewport's width is itself ambiguous once the sidebar is
// involved (with the sidebar visible it's window width minus 256px; without it, equal to window
// width) -- window.innerWidth is the one unambiguous signal for which layout mode applies.
const MOBILE_BREAKPOINT = 768;

function blockedCellKeys(): Set<string> {
  const set = new Set<string>();
  for (const o of FIXED_OBJECTS) set.add(`${o.col},${o.row}`);
  for (const c of PATH_CELLS) set.add(`${c.col},${c.row}`);
  return set;
}

export function MemberPlotSliceHarness({
  dailyLessonTitle,
  dailyLessonScripture,
  dailyLessonHref,
}: {
  dailyLessonTitle: string | null;
  dailyLessonScripture: string | null;
  dailyLessonHref: string | null;
}) {
  const coreCenter = useMemo(() => gridToScreen(CORE_COL_START + CORE_SIZE / 2, CORE_ROW_START + CORE_SIZE / 2), []);
  // A preference, not a hard limit: how close the camera can zoom in on a normally-sized viewport.
  // If the viewport is so large that even the responsive cover scale (below) exceeds this, maxZoom
  // stretches to match it -- minZoom must never exceed maxZoom, or the zoom range inverts.
  const PREFERRED_MAX_ZOOM = 1.1;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  // Measured, not assumed: the responsive minimum zoom depends on the viewport's actual on-screen
  // size (width and height net of the top HUD and the right inventory panel -- both already
  // excluded automatically, since this measures the real flex-laid-out viewport element itself,
  // not window.innerWidth/Height minus hard-coded chrome sizes). Re-measured on any resize --
  // browser window resize, the inventory panel's responsive show/hide breakpoint, orientation
  // change -- via ResizeObserver, so none of those can stale out the bounds.
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // Measure synchronously on mount (getBoundingClientRect), not only via ResizeObserver's own
    // first callback -- ResizeObserver's initial report is asynchronous (queued as a microtask
    // after layout), so relying on it alone leaves one real render where viewportSize is still
    // null. That's normally a one-frame gap (harmless: the null-fallback bounds below are the most
    // conservative possible state), but there's no reason to accept even that when a synchronous
    // measurement is available for free.
    const rect = el.getBoundingClientRect();
    setViewportSize({ w: rect.width, h: rect.height });
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    // Belt-and-suspenders alongside ResizeObserver: a plain window resize listener re-measuring
    // directly. ResizeObserver alone should be sufficient in a normal browser, but this covers any
    // environment where ResizeObserver callbacks are unreliable, and is what actually fires for the
    // inventory panel's CSS-breakpoint show/hide (that's driven by a window-width media query, so a
    // window resize always accompanies it).
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

  // Mobile-layout detection -- see MOBILE_BREAKPOINT's own comment for why this tracks
  // window.innerWidth directly rather than the map viewport's own measured size.
  const [windowWidth, setWindowWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobileLayout = windowWidth !== null && windowWidth < MOBILE_BREAKPOINT;

  const { placements, place, moveExisting, remove } = usePlotPlacements();
  const { roads, placeRoad, removeRoad } = useRoadPlacements();

  const [buildMode, setBuildMode] = useState(false);
  const [selectedPlaceableId, setSelectedPlaceableId] = useState<string | null>(null);
  const [movingInstanceId, setMovingInstanceId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [roadToolActive, setRoadToolActive] = useState(false);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  // Mobile-only UI state. Desktop never touches these -- the desktop sidebar and its existing
  // click-to-commit placement flow are completely unmodified by this feature.
  const [inventorySheetState, setInventorySheetState] = useState<SheetState>("closed");
  const [lessonSheetState, setLessonSheetState] = useState<SheetState>("closed");

  const activeAssetId = selectedPlaceableId ?? placements.find((p) => p.instanceId === movingInstanceId)?.assetId ?? null;

  // True whenever a single-finger drag on the viewport should reposition the placement/road ghost
  // instead of panning the camera -- see useWorldCamera's `panEnabled` option. Mobile has no hover
  // state, so positioning the ghost and panning the map previously used the exact same pointer
  // sequence; this is what disambiguates them (root cause of the Phase 1 mobile placement
  // regression -- the camera shifting under the finger mid-drag corrupted which cell the release
  // landed on).
  const isBuildToolActive = buildMode && (roadToolActive || !!activeAssetId);

  // The responsive minimum zoom -- see computeCoverMinZoom's own comment for the "cover" math.
  // Before the first ResizeObserver measurement (one frame, typically), fall back to
  // PREFERRED_MAX_ZOOM: the most conservative possible state (fully zoomed in, zero pan slack),
  // which can never expose empty space during that gap.
  //
  // Run through the app-wide clampZoom (the same MIN_ZOOM/MAX_ZOOM every other camera in this app
  // respects, and the same clamp useWorldCamera's own clampScale applies as its first step) so this
  // component's own bookkeeping (initial scale, the Zoom Out disabled check, Reset View's target)
  // can never target a scale that's actually unreachable. Without this, a viewport wide/short
  // enough that the raw cover formula wants a scale below the app's global floor would leave the
  // Zoom Out button permanently enabled past the point where zooming out has any effect (the real
  // enforced floor becomes the global MIN_ZOOM, silently different from this cover-scale value).
  const rawMinZoom = viewportSize ? computeCoverMinZoom(viewportSize.w, viewportSize.h) : PREFERRED_MAX_ZOOM;
  const minZoom = clampZoom(rawMinZoom);
  const maxZoom = Math.max(PREFERRED_MAX_ZOOM, minZoom);
  const initialCamera: CameraTarget = { x: coreCenter.x, y: coreCenter.y, scale: minZoom };

  // Bounds live on the camera hook itself (both x/y AND scale, per useWorldCamera's own comment on
  // why scale can't be clamped separately at render time only). getXYBounds recomputes pan bounds
  // fresh at whatever scale the camera actually ends up at, instead of solving once for a single
  // worst-case zoom level -- see computeXYBoundsAtScale's own comment.
  const bounds = useMemo(() => {
    if (!viewportSize) {
      // Before the first measurement: stay pinned exactly on center rather than opening up pan
      // range against a viewport size we haven't actually measured yet.
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

  // One-time-only: once the viewport's real size is known, snap the initial view to the true cover
  // scale so the first paint shows the whole plot in frame, rather than staying at the
  // pre-measurement PREFERRED_MAX_ZOOM fallback for the rest of the session. Guarded by a ref (not
  // re-run on every later resize) so this never fights a user who has since deliberately zoomed --
  // ordinary resize-driven re-clamping is handled unconditionally by useWorldCamera's own
  // render-time clamp, this only establishes a nicer *initial* framing.
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

  // A road cell is valid to PLACE a new road on if it's empty of everything (same rules as a
  // relic) -- roads and relics share the same core footprint and can't overlap either.
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

  // Screen point -> world point -> nearest grid cell, inverting the exact render transform
  // (translate 50%/50%, scale, translate -camera.x/-camera.y) applied to the world container. The
  // actual math lives in screenToGrid (memberPlotSliceLayout.ts) as a pure, camera-state-explicit
  // function so it's unit testable independent of this component and its refs.
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

  // Tracks whether THIS pointer gesture (down -> up) moved meaningfully, so handleClick can tell a
  // genuine drag's terminating click apart from a real tap -- see gestureStartRef's own comment on
  // handleClick for why this matters.
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

  // Commits whatever relic placement/move is currently pending at `cell`. Shared by desktop's
  // immediate click-to-commit flow and mobile's explicit Confirm button -- one code path, so the
  // two can never drift out of sync with each other.
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
    // Mobile has no hover, so a tap can't preview a cell before committing to it the way a desktop
    // mouse-hover-then-click can. The documented mobile model is therefore two actions: position
    // the ghost (tap or drag), then a SEPARATE confirming action commits it -- either the explicit
    // toolbar Confirm button (commitRelicPlacement, called directly from there), or -- this branch
    // -- tapping the SAME cell again once it's already locked in as hoverCell.
    //
    // That second path exists because real-user testing (a screen recording of the desktop-style
    // click-to-commit instinct carrying over into the narrowed/mobile layout) showed people
    // instinctively re-tapping the object they'd just positioned, expecting that to place it the
    // same way a desktop click does, rather than reaching for the separate checkmark below -- the
    // Confirm button was never unreliable, it just wasn't where their attention already was. This
    // makes the instinctive gesture work too, without weakening the "release never auto-commits"
    // rule: gestureMovedRef distinguishes a real repeat tap (no movement in *this* gesture) from
    // the click that fires immediately after a drag ends on the same cell (gestureMovedRef true
    // there, since the drag itself moved the pointer) -- only the former commits.
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

  // Shared by the desktop sidebar grid and the mobile inventory sheet's grid. On mobile, selecting
  // an item auto-closes the sheet (the spec allows either "close or collapse"; closing fully is
  // what's used here since the mobile placement toolbar and the sheet both live at the bottom of
  // the screen -- collapsing instead would leave the sheet's own bottom-anchored panel stacked
  // directly on top of the toolbar, at the same z-index layer, hiding it entirely) so the map and
  // the placement toolbar are immediately usable without an extra tap.
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
        cancelPlacement(); // exiting build mode always clears any in-progress placement
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
      <WorldHud displayName="Coty Elder" avatarUrl={null} level={24} xpTotal={4820} pointsTotal={0} isSignedIn={true} />

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
            {/* Click targets for existing placements, in the same transformed layer so they align
                with the rendered objects -- placed as invisible hit-areas over MemberPlotSlice's
                own (non-interactive) rendering. */}
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
            <div className="ks-panel absolute left-3 top-3 z-10 p-3 flex items-center gap-3">
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
            <div className="ks-panel absolute left-3 top-3 z-10 p-3">
              <span className="text-xs" style={{ color: "var(--ks-text-dim)" }}>
                Road tool active -- click an empty cell to place a connected road segment, or click an existing road to edit it.
              </span>
            </div>
          )}

          {!isMobileLayout && buildMode && selectedRoad && (
            <div className="ks-panel absolute left-3 top-3 z-10 p-3 flex items-center gap-3">
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

          {/* Camera controls -- Zoom Out disables exactly at the responsive cover-scale minimum
              (isAtMinZoom), not a hard-coded threshold, so it tracks minZoom through every resize.
              Reset View returns to that same responsive minimum, per spec ("Reset Camera uses the
              responsive cover scale"), not the original fixed initial scale. */}
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

        {/* Seeker Inventory -- the placeable-object panel, only meaningfully usable in Build mode
            (selection still works outside Build mode but has no effect since ghost/placement
            logic is gated on buildMode above).
            Visibility is driven by the SAME isMobileLayout JS boolean the mobile controls below
            use, not a separate CSS media query -- a `hidden md:flex` class here (evaluated by the
            CSS engine against the true browser viewport) and a JS window.innerWidth check (driving
            the mobile UI) are two independent breakpoint mechanisms that could disagree during a
            resize, or whenever anything decouples the CSS viewport from window.innerWidth. One
            shared source of truth means the desktop sidebar and the mobile controls can never both
            be visible, or both be absent, at the same time. Rendered by default (isMobileLayout is
            false until the first measurement) so there's no flash-of-missing-sidebar before JS runs. */}
        {!isMobileLayout && (
        <aside className="ks-dock-panel flex flex-col border-l w-64 shrink-0">
          <div className="p-3" style={{ borderBottom: "1px solid var(--ks-bronze-dim)" }}>
            <span className="ks-panel-title">Seeker Inventory</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto qk-scrollbar">
            <p className="text-[10px] mb-3" style={{ color: "var(--ks-text-dim)" }}>
              Development fixture -- these are the 6 initial Lesson Relics, not the real 48-relic
              catalog or real ownership data. {buildMode ? "Select one, then click a green cell to place it." : "Enter Build mode to place these on your plot."}
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

          {/* Road Building -- one coordinated 5-piece family (Phase 4 checkpoint). Activating the
              tool doesn't require picking an individual piece: placement is connection-aware --
              the correct piece + rotation is resolved automatically from whichever neighboring
              cells already have a road, per docs/MEMBER_PLOT_ASSET_ARCHITECTURE_PHASE3A.md. */}
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
        />
      )}
    </div>
  );
}
