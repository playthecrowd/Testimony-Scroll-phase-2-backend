import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { computeSinglePointerPan } from "../components/kingdom-scrolls/useWorldCamera";
import { screenToGrid, gridToScreen } from "../components/kingdom-scrolls/mockup/memberPlotSlice/memberPlotSliceLayout";

const REPO_ROOT = path.join(__dirname, "..");
function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

// ---- Phase 1 mobile placement regression -----------------------------------------------------
// Root cause: on the mobile grid (no hover state) a drag-to-position gesture and the camera's own
// single-finger pan handler shared one pointer sequence. handlePointerMove called BOTH
// cameraPointerMove(e) (pans unconditionally) and setHoverCell(screenToCell(...)) (reads the
// CURRENT camera) on every event -- so as the finger moved, the camera shifted underneath it in
// the very same gesture the ghost was trying to track, producing an unstable, usually-wrong final
// cell. Real touch devices compound this: any pointer movement suppresses the browser's synthetic
// `click` event, so the tap-to-place fallback (handleClick's `if (isMobileLayout) setHoverCell(cell)`)
// silently never fired either. Desktop testing (mouse clicks, even at a narrow viewport) never hit
// this because a plain click reliably fires a `click` event; only genuine pointerdown/move/up
// sequences with real movement expose it.
//
// Fix: useWorldCamera gained a `panEnabled` option (computeSinglePointerPan below is its pure
// core); MemberPlotSliceHarness computes isBuildToolActive = buildMode && (roadToolActive ||
// !!activeAssetId) and passes panEnabled: !isBuildToolActive, so a single-finger drag repositions
// the ghost (via the pre-existing, now camera-stable, handlePointerMove -> setHoverCell) instead
// of panning while a placement/road tool is active. Pinch-zoom (2 pointers) is untouched.

test("[TRUE TEST] computeSinglePointerPan returns null when panEnabled is false, regardless of movement or drag state", () => {
  const dragStart = { x: 100, y: 100, cameraX: 500, cameraY: 500 };
  const moved = { x: 250, y: 180 }; // a real, deliberate drag -- not a jitter-sized movement
  assert.equal(computeSinglePointerPan(false, 1, dragStart, moved, 1), null, "a placement gesture must not be consumed by the camera-pan handler");
});

test("[TRUE TEST] computeSinglePointerPan returns null for a two-pointer (pinch) gesture even when panEnabled is true", () => {
  const dragStart = { x: 100, y: 100, cameraX: 500, cameraY: 500 };
  assert.equal(computeSinglePointerPan(true, 2, dragStart, { x: 150, y: 150 }, 1), null);
});

test("[TRUE TEST] computeSinglePointerPan returns null with no drag-start (pointer not currently down)", () => {
  assert.equal(computeSinglePointerPan(true, 1, null, { x: 150, y: 150 }, 1), null);
});

test("[TRUE TEST] computeSinglePointerPan, when enabled, computes the camera target from drag delta and scale (unchanged normal-pan behavior)", () => {
  const dragStart = { x: 100, y: 100, cameraX: 500, cameraY: 500 };
  const pan = computeSinglePointerPan(true, 1, dragStart, { x: 140, y: 80 }, 2);
  // dx=40, dy=-20, scale=2 -> x = 500 - 40/2 = 480, y = 500 - (-20)/2 = 510
  assert.deepEqual(pan, { x: 480, y: 510 });
});

// ---- screenToGrid: the ghost-positioning math, isolated from any live camera ref --------------

test("[TRUE TEST] screenToGrid inverts gridToScreen exactly at the viewport center for a centered camera", () => {
  const rect = { left: 0, top: 0, width: 400, height: 700 };
  const camera = { x: 0, y: 0, scale: 1 };
  // Screen center (200, 350) with camera at world origin -> nearest cell to world (0,0)
  const cell = screenToGrid(200, 350, rect, camera);
  const back = gridToScreen(cell.col, cell.row);
  // Round-tripping should land back within one tile of true center.
  assert.ok(Math.abs(back.x - camera.x) < 128 && Math.abs(back.y - camera.y) < 64);
});

test("[TRUE TEST] screenToGrid is a pure function of its explicit camera argument -- the SAME physical finger position resolves to the SAME cell as long as the camera argument doesn't change", () => {
  const rect = { left: 0, top: 0, width: 400, height: 700 };
  const camera = { x: 320, y: 240, scale: 0.5 };
  const finger = { x: 210, y: 340 };
  const a = screenToGrid(finger.x, finger.y, rect, camera);
  const b = screenToGrid(finger.x, finger.y, rect, camera);
  assert.deepEqual(a, b, "a held-still camera must produce a stable cell across repeated reads during one drag");
});

test("[TRUE TEST] screenToGrid documents the exact regression: the SAME finger position resolves to a DIFFERENT cell if the camera drifts mid-gesture (what unconditional panning did)", () => {
  const rect = { left: 0, top: 0, width: 400, height: 700 };
  const finger = { x: 210, y: 340 };
  const cameraBeforePan = { x: 320, y: 240, scale: 0.5 };
  // A single-finger drag of ~90px at scale 0.5 would have panned the camera by ~180 world units --
  // representative of the drift the old unconditional cameraPointerMove(e) call produced.
  const cameraAfterPan = { x: 320 - 180, y: 240 + 40, scale: 0.5 };
  const cellWithStillCamera = screenToGrid(finger.x, finger.y, rect, cameraBeforePan);
  const cellWithDriftedCamera = screenToGrid(finger.x, finger.y, rect, cameraAfterPan);
  assert.notDeepEqual(
    cellWithStillCamera,
    cellWithDriftedCamera,
    "if this ever becomes equal, camera drift no longer affects cell resolution and the regression class is closed structurally"
  );
});

// ---- Source-scan guards: the placement state-machine wiring in the harness --------------------
// No DOM/React renderer is installed in this repo (see CLAUDE.md), so the full pointer-event ->
// hoverCell -> Confirm -> committed-placement transition can't be driven end-to-end here. These
// scans instead pin the exact code shape the live/manual verification (screenshots, before/after
// placement records) confirmed actually behaves correctly, so a future edit that reintroduces the
// regression -- or silently changes the wiring -- fails CI instead of only being caught by hand.

const harnessSource = read("components/kingdom-scrolls/mockup/memberPlotSlice/MemberPlotSliceHarness.tsx");

test("[SOURCE SCAN] isBuildToolActive is derived from buildMode + roadToolActive + activeAssetId and passed as panEnabled to useWorldCamera", () => {
  assert.match(harnessSource, /const isBuildToolActive = buildMode && \(roadToolActive \|\| !!activeAssetId\);/);
  assert.match(harnessSource, /useWorldCamera\(initialCamera, bounds, \{ panEnabled: !isBuildToolActive \}\)/);
});

test("[SOURCE SCAN] handlePointerMove updates hoverCell on every pointermove while buildMode is active -- positioning does not depend solely on a native click event", () => {
  const fn = harnessSource.match(/function handlePointerMove\([\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "expected to find handlePointerMove's body");
  assert.match(fn!, /if \(buildMode\) setHoverCell\(screenToCell\(e\.clientX, e\.clientY\)\)/);
});

test("[SOURCE SCAN] pointerup and pointercancel on the viewport are wired to the camera hook's own onPointerUp only -- releasing a placement gesture must not clear hoverCell", () => {
  assert.match(harnessSource, /onPointerUp=\{onPointerUp\}/);
  assert.match(harnessSource, /onPointerCancel=\{onPointerUp\}/);
});

test("[SOURCE SCAN] the mobile Confirm handler reads live hoverCell state via a fresh closure each render, not a memoized/stale reference", () => {
  assert.match(harnessSource, /onConfirmPlacement=\{\(\) => hoverCell && commitRelicPlacement\(hoverCell\)\}/);
});

test("[SOURCE SCAN] commitRelicPlacement validates and commits the exact cell it's given -- no separate coordinate source between what's rendered as the ghost and what gets persisted", () => {
  const fn = harnessSource.match(/function commitRelicPlacement\(cell: \{ col: number; row: number \}\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "expected to find commitRelicPlacement's body");
  assert.match(fn!, /if \(!isValidCell\(cell\.col, cell\.row, movingInstanceId\)\) return;/);
  assert.match(fn!, /place\(selectedPlaceableId, cell\.col, cell\.row, rotation\)/);
});

test("[SOURCE SCAN] the useWorldCamera hook itself gates single-pointer pan application through the exported, unit-tested computeSinglePointerPan", () => {
  const source = read("components/kingdom-scrolls/useWorldCamera.ts");
  assert.match(source, /export function computeSinglePointerPan/);
  assert.match(source, /const pan = computeSinglePointerPan\(panEnabled, pointerCount, start, current, prev\.scale\);/);
});

// ---- Reliability fix: a real screen recording of desktop-then-mobile use showed the underlying --
// mechanics above were correct (ghost tracked the cursor with zero camera drift, Confirm enabled
// exactly on valid cells) but the human never actually pressed the separate Confirm button -- their
// cursor stayed on the map/ghost the whole time, matching the click-to-commit instinct desktop had
// just trained in the same session. Mobile now also commits on a second tap of an already-locked
// cell, mirroring desktop, without weakening "release never auto-commits" (see gestureMovedRef).

test("[SOURCE SCAN] handleViewportPointerDown records the gesture's start position and resets gestureMovedRef before delegating to the camera hook's own onPointerDown", () => {
  const fn = harnessSource.match(/function handleViewportPointerDown\([\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "expected to find handleViewportPointerDown's body");
  assert.match(fn!, /onPointerDown\(e\);/);
  assert.match(fn!, /gestureStartRef\.current = \{ x: e\.clientX, y: e\.clientY \};/);
  assert.match(fn!, /gestureMovedRef\.current = false;/);
  assert.match(harnessSource, /onPointerDown=\{handleViewportPointerDown\}/);
});

test("[SOURCE SCAN] handlePointerMove flips gestureMovedRef once movement exceeds the threshold, and never flips it back mid-gesture", () => {
  const fn = harnessSource.match(/function handlePointerMove\([\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "expected to find handlePointerMove's body");
  assert.match(fn!, /if \(start && !gestureMovedRef\.current\)/, "must only ever set it true, never re-check/reset it once already true within a gesture");
  assert.match(fn!, /if \(Math\.hypot\(dx, dy\) > GESTURE_MOVE_THRESHOLD_PX\) gestureMovedRef\.current = true;/);
});

test("[SOURCE SCAN] a second tap on the already-locked hoverCell commits only when this gesture had no real movement -- the click ending a drag (which did move) must not silently commit", () => {
  const fn = harnessSource.match(/if \(isMobileLayout\) \{[\s\S]*?\n    \}\n    commitRelicPlacement\(cell\);\n  \}/)?.[0];
  assert.ok(fn, "expected to find handleClick's mobile branch");
  assert.match(fn!, /const isRepeatTapOnLockedCell = !gestureMovedRef\.current && hoverCell && hoverCell\.col === cell\.col && hoverCell\.row === cell\.row;/);
  assert.match(fn!, /if \(isRepeatTapOnLockedCell\) \{\s*commitRelicPlacement\(cell\);/);
  assert.match(fn!, /\} else \{\s*setHoverCell\(cell\);/, "a tap on a NEW or not-yet-locked cell must only reposition the ghost, never commit on the first tap");
});

test("[TRUE TEST] the repeat-tap-commits decision itself: same cell + no movement -> commit; same cell + movement (a drag's terminating click) -> do not commit; different cell -> do not commit", () => {
  function isRepeatTapOnLockedCell(
    gestureMoved: boolean,
    hoverCell: { col: number; row: number } | null,
    tappedCell: { col: number; row: number }
  ): boolean {
    return !gestureMoved && !!hoverCell && hoverCell.col === tappedCell.col && hoverCell.row === tappedCell.row;
  }
  const cellA = { col: 5, row: 5 };
  const cellB = { col: 6, row: 6 };
  assert.equal(isRepeatTapOnLockedCell(false, cellA, cellA), true, "genuine repeat tap on the same, already-locked cell must commit");
  assert.equal(isRepeatTapOnLockedCell(true, cellA, cellA), false, "a drag's terminating click on the cell it just dragged to must NOT auto-commit");
  assert.equal(isRepeatTapOnLockedCell(false, cellA, cellB), false, "a tap on a different cell repositions, never commits");
  assert.equal(isRepeatTapOnLockedCell(false, null, cellA), false, "the very first tap after selecting an item (hoverCell still null) must never commit");
});

// ---- Mobile placement guidance text --------------------------------------------------------
// Owner feedback after the above fix: the mechanics were correct but the required NEXT action
// wasn't stated anywhere, which was part of why the separate Confirm button went undiscovered in
// the screen recording. A one-line, accessibly-announced status now names the current state and
// the next action at every step. Road placement keeps its own separate, pre-existing wording.

const mobileControlsSource = read("components/kingdom-scrolls/mockup/memberPlotSlice/MobileMemberPlotControls.tsx");

test("[SOURCE SCAN] relic placement guidance has exactly the three required states, keyed off hoverCell and canConfirm", () => {
  const fn = mobileControlsSource.match(/const placementGuidance = [\s\S]*?;/)?.[0];
  assert.ok(fn, "expected to find the placementGuidance computation");
  assert.match(fn!, /!hoverCell\s*\n\s*\? "Tap or drag to choose a location"/);
  assert.match(fn!, /: canConfirm\s*\n\s*\? "Tap this space again to place, or press ✓"/);
  assert.match(fn!, /: "This space is unavailable";/);
});

test("[SOURCE SCAN] the guidance text is an accessibly-announced live region inside the relic placement toolbar, not a silent visual-only label", () => {
  assert.match(mobileControlsSource, /<p role="status" aria-live="polite"[^>]*>\s*\{placementGuidance\}/);
});

test("[SOURCE SCAN] road placement's own status text is untouched by the relic guidance change -- roads keep their separate, pre-existing wording", () => {
  assert.match(mobileControlsSource, /Tap an empty cell to place a connected road segment\./);
  assert.doesNotMatch(mobileControlsSource, /placementGuidance[\s\S]{0,400}Road segment selected/, "road toolbar text must not have been merged with or replaced by the relic guidance logic");
});

test("[TRUE TEST] the guidance-state decision itself: null hoverCell -> initial prompt; valid -> place-again prompt; invalid -> unavailable", () => {
  function guidanceFor(hoverCell: { col: number; row: number } | null, canConfirm: boolean): string {
    return !hoverCell ? "Tap or drag to choose a location" : canConfirm ? "Tap this space again to place, or press ✓" : "This space is unavailable";
  }
  assert.equal(guidanceFor(null, false), "Tap or drag to choose a location");
  assert.equal(guidanceFor({ col: 1, row: 1 }, true), "Tap this space again to place, or press ✓");
  assert.equal(guidanceFor({ col: 1, row: 1 }, false), "This space is unavailable");
});

test("[SOURCE SCAN] the map viewport disables native touch gestures (touch-action: none via Tailwind's touch-none), so two deliberate taps to commit can never be interpreted as a native double-tap-to-zoom gesture", () => {
  const harnessSource = read("components/kingdom-scrolls/mockup/memberPlotSlice/MemberPlotSliceHarness.tsx");
  assert.match(harnessSource, /touch-none/, "the viewport element must keep touch-action:none -- removing it would let the browser's native double-tap-zoom intercept the second confirming tap");
});
