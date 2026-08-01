"use client";

import { BottomSheet, SheetState } from "./BottomSheet";
import { PLACEABLE_CATALOG } from "./placeableCatalog";
import { ROAD_PREVIEW_MASKS_FOR_PICKER } from "./roadPreviewMasks";
import { RoadTileSvg } from "./RoadTileSvg";
import type { RoadPlacement } from "./roadSystem";
import type { Rotation } from "./usePlotPlacements";

// Mobile-only UI for the Member Plot: a persistent Seeker Inventory launcher (with item count and
// selected-item indicator), a persistent Daily Lesson launcher, two bottom sheets, and a compact
// placement toolbar. Entirely additive -- MemberPlotSliceHarness.tsx only renders this when
// isMobileLayout is true, and every callback here is the SAME function the desktop UI calls, so
// there is exactly one placement/road/lesson code path underneath both UIs. See
// docs/MOBILE_INVENTORY_ACCESSIBILITY.md for the full design rationale and test results.
export function MobileMemberPlotControls({
  buildMode,
  roadToolActive,
  selectedRoad,
  selectedPlaceableId,
  movingInstanceId,
  hoverCell,
  isValidCell,
  rotation,
  onRotate,
  onConfirmPlacement,
  onCancel,
  onRemoveMoving,
  onRemoveRoad,
  onCancelRoad,
  activeAssetLabel,
  inventorySheetState,
  setInventorySheetState,
  lessonSheetState,
  setLessonSheetState,
  selectedPlaceable,
  onSelectPlaceable,
  onToggleRoadTool,
  dailyLessonTitle,
  dailyLessonScripture,
  dailyLessonHref,
  // Caller-supplied so the mockup and the production Inventory Land harness can each show copy
  // appropriate to what they actually are, without duplicating this whole component. Defaults to
  // the original mockup wording so MemberPlotSliceHarness.tsx (which doesn't pass this prop) is
  // completely unaffected.
  inventoryDescription = 'Development fixture -- these are the 6 initial Lesson Relics, not the real 48-relic catalog or real ownership data.',
}: {
  buildMode: boolean;
  roadToolActive: boolean;
  selectedRoad: RoadPlacement | null;
  selectedPlaceableId: string | null;
  movingInstanceId: string | null;
  hoverCell: { col: number; row: number } | null;
  isValidCell: (col: number, row: number, excludeInstanceId: string | null) => boolean;
  rotation: Rotation;
  onRotate: () => void;
  onConfirmPlacement: () => void;
  onCancel: () => void;
  onRemoveMoving: () => void;
  onRemoveRoad: () => void;
  onCancelRoad: () => void;
  activeAssetLabel: string | null;
  inventorySheetState: SheetState;
  setInventorySheetState: (s: SheetState) => void;
  lessonSheetState: SheetState;
  setLessonSheetState: (s: SheetState) => void;
  selectedPlaceable: string | null;
  onSelectPlaceable: (assetId: string) => void;
  onToggleRoadTool: () => void;
  dailyLessonTitle: string | null;
  dailyLessonScripture: string | null;
  dailyLessonHref: string | null;
  inventoryDescription?: string;
}) {
  const isPlacingRelic = buildMode && !roadToolActive && (!!selectedPlaceableId || !!movingInstanceId);
  const isRoadToolShowing = buildMode && roadToolActive;
  const hidePersistentButtons = isPlacingRelic || isRoadToolShowing;
  const canConfirm = !!hoverCell && isValidCell(hoverCell.col, hoverCell.row, movingInstanceId);

  // Relic placement guidance -- see docs/... the fix for the reopened Phase 1 regression: the
  // underlying commit mechanics were already correct, but real-user testing (a screen recording)
  // showed the separate Confirm button wasn't reliably *discovered* -- attention stayed on the
  // map/ghost, never traveled down to the toolbar. This one-line status makes the current state and
  // the next required action explicit at every step, right where the user is already looking.
  // Road placement has its own, separately-worded status text below and is untouched by this.
  const placementGuidance = !hoverCell
    ? "Tap or drag to choose a location"
    : canConfirm
    ? "Tap this space again to place, or press ✓"
    : "This space is unavailable";

  return (
    <>
      {/* Persistent Daily Lesson launcher -- top-left, opposite the Build button (top-right), so
          neither ever overlaps the other. Hidden while a placement toolbar occupies the bottom
          area purely to reduce on-screen clutter during an active placement, not because the
          lesson stops being reachable -- it reappears the instant placement ends. */}
      {!hidePersistentButtons && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLessonSheetState("half");
          }}
          aria-label="Open Daily Lesson Pavilion"
          className="ks-btn absolute left-3 z-10 flex items-center gap-1.5 px-3"
          style={{ top: 12, minHeight: 44 }}
        >
          <span aria-hidden>📖</span>
          <span className="text-xs font-semibold">Lesson</span>
        </button>
      )}

      {/* Persistent Seeker Inventory launcher -- bottom-left, deliberately clear of the zoom
          controls (bottom-right). Shows the item count and a dot when something is currently
          selected, satisfying "display the number of available items" / "indicate the currently
          selected item" without needing the sheet open. Replaced by the placement toolbar (below)
          while something is actively being placed, in the same screen position. */}
      {!hidePersistentButtons && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInventorySheetState("half");
          }}
          aria-label={`Open Seeker Inventory, ${PLACEABLE_CATALOG.length} items available${selectedPlaceable ? ", one selected" : ""}`}
          className="ks-btn absolute left-3 z-10 flex items-center gap-2 px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", minHeight: 44 }}
        >
          <span aria-hidden>🎒</span>
          <span className="text-xs font-semibold">Seeker Inventory</span>
          <span
            aria-hidden
            className="flex items-center justify-center rounded-full text-[10px] font-bold"
            style={{ minWidth: 18, height: 18, padding: "0 4px", background: "var(--ks-gold)", color: "#1a1200" }}
          >
            {PLACEABLE_CATALOG.length}
          </span>
          {selectedPlaceable && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: "#7fbf6a" }} />}
        </button>
      )}

      {/* Mobile placement toolbar -- relics. Out of the map's primary interaction area (a fixed
          bar along the bottom, not overlapping the grid itself). Confirm is disabled until a valid
          cell has actually been tapped, and Remove only appears when editing an existing
          placement, matching the desktop panel's own permission logic (usePlotPlacements'
          `remove`, already wired identically for both). */}
      {isPlacingRelic && (
        <div
          className="ks-panel absolute left-3 right-3 z-10 flex flex-col gap-1.5 px-3 py-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          role="toolbar"
          aria-label="Placement controls"
        >
          {/* role="status" + aria-live: React re-rendering this text on every hoverCell/validity
              change is enough for assistive tech to announce it on its own -- no manual
              announcement call needed. */}
          <p role="status" aria-live="polite" className="text-xs font-semibold text-center" style={{ color: canConfirm ? "#7fbf6a" : hoverCell ? "#e05a4a" : "var(--ks-text-dim)" }}>
            {placementGuidance}
          </p>
          <div className="flex items-center gap-2">
          <span className="text-xs font-semibold truncate flex-1" style={{ color: "var(--ks-text)" }}>
            {movingInstanceId ? "Moving: " : "Placing: "}
            {activeAssetLabel ?? "item"} ({rotation}&deg;)
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            aria-label="Rotate item"
            className="ks-btn flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>
              ⟳
            </span>
          </button>
          {movingInstanceId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveMoving();
              }}
              aria-label="Remove item"
              className="ks-btn flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>
                🗑
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmPlacement();
            }}
            aria-label="Confirm placement"
            className="ks-btn ks-btn-active flex items-center justify-center disabled:opacity-40"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>
              ✓
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            aria-label="Cancel placement"
            className="ks-btn flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>
              ✕
            </span>
          </button>
          </div>
        </div>
      )}

      {/* Mobile road toolbar -- roads never show a Rotate control (connection-driven, not
          user-rotated), matching the desktop road panels exactly. */}
      {isRoadToolShowing && !selectedRoad && (
        <div
          className="ks-panel absolute left-3 right-3 z-10 flex items-center gap-2 px-3 py-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <span className="text-xs flex-1" style={{ color: "var(--ks-text-dim)" }}>
            Tap an empty cell to place a connected road segment.
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRoadTool();
            }}
            aria-label="Exit road tool"
            className="ks-btn flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>
              ✕
            </span>
          </button>
        </div>
      )}
      {isRoadToolShowing && selectedRoad && (
        <div
          className="ks-panel absolute left-3 right-3 z-10 flex items-center gap-2 px-3 py-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <span className="text-xs flex-1" style={{ color: "var(--ks-text-dim)" }}>
            Road segment selected
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveRoad();
            }}
            aria-label="Remove road segment"
            className="ks-btn flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>
              🗑
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelRoad();
            }}
            aria-label="Deselect road segment"
            className="ks-btn flex items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>
              ✕
            </span>
          </button>
        </div>
      )}

      <BottomSheet
        state={inventorySheetState}
        onStateChange={setInventorySheetState}
        title="Seeker Inventory"
        ariaLabel="Seeker Inventory -- select an item to place on your plot"
      >
        <p className="text-[11px] mb-3" style={{ color: "var(--ks-text-dim)" }}>
          {inventoryDescription} {buildMode ? "Tap one, then tap a green cell to preview its placement." : "Enter Build mode to place these on your plot."}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PLACEABLE_CATALOG.map((item) => (
            <button
              key={item.assetId}
              type="button"
              disabled={!buildMode}
              onClick={() => onSelectPlaceable(item.assetId)}
              className={`ks-panel flex items-center gap-2 p-2 disabled:opacity-40 ${selectedPlaceable === item.assetId ? "ks-btn-active" : ""}`}
              style={{ minHeight: 64 }}
              aria-pressed={selectedPlaceable === item.assetId}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.assetPath} alt="" className="w-10 h-10 object-contain shrink-0" />
              <span className="text-xs text-left leading-tight" style={{ color: "var(--ks-text)" }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--ks-bronze-dim)", paddingTop: 12 }}>
          <p className="ks-panel-title mb-2">Road Building</p>
          <p className="text-[11px] mb-3" style={{ color: "var(--ks-text-dim)" }}>
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
            onClick={onToggleRoadTool}
            className={`ks-btn w-full text-sm disabled:opacity-40 ${roadToolActive ? "ks-btn-active" : ""}`}
            style={{ minHeight: 44 }}
          >
            {roadToolActive ? "Exit Road Tool" : "Build Roads"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet state={lessonSheetState} onStateChange={setLessonSheetState} title="Daily Lesson Pavilion" ariaLabel="Daily Lesson Pavilion">
        {dailyLessonTitle ? (
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
              <a href={dailyLessonHref} className="ks-btn text-sm mt-3 w-full block text-center" style={{ minHeight: 44, lineHeight: "44px" }}>
                Begin Lesson
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--ks-text-dim)" }}>
            No campaign lesson is available this week.
          </p>
        )}
      </BottomSheet>
    </>
  );
}
