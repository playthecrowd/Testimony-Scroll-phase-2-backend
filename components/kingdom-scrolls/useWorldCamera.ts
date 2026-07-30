"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CameraTarget, clampZoom } from "@/lib/kingdomScrollsWorld";

export interface CameraBounds {
  // Static x/y bounds, used when getXYBounds isn't provided. A single fixed box like this can only
  // be correct at one scale (it can't simultaneously stay minimal at every zoom level), so scenes
  // that need bounds to hold across a real zoom range should prefer getXYBounds instead.
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  // Optional scene-local zoom range, tighter than the global MIN_ZOOM/MAX_ZOOM. Deliberately part
  // of the same bounds object as x/y rather than a separate clamp applied only at render time --
  // every setCamera call in this hook (pan, pinch, wheel, flyTo) must clamp scale through the same
  // path that clamps x/y, since x/y bounds enforcement itself depends on the current scale
  // (screen-delta-to-world-delta conversion divides by it). A render-only scale clamp would leave
  // the hook's internal state using an unclamped scale for that math, silently desyncing what's
  // displayed from what pan-bounds are actually being enforced against.
  minZoom?: number;
  maxZoom?: number;
  // If provided, computes x/y bounds fresh from the (already scale-clamped) scale on every clamp
  // call -- lets pan bounds tighten as the camera zooms out and loosen as it zooms in, instead of a
  // single static box that has to stay safe across the whole zoom range simultaneously. Takes
  // precedence over minX/maxX/minY/maxY when present.
  getXYBounds?: (scale: number) => { minX: number; maxX: number; minY: number; maxY: number };
}

function clampScale(scale: number, bounds: CameraBounds | undefined): number {
  const clamped = clampZoom(scale);
  if (!bounds) return clamped;
  const lo = bounds.minZoom ?? clamped;
  const hi = bounds.maxZoom ?? clamped;
  return Math.min(hi, Math.max(lo, clamped));
}

function clampToBounds(target: CameraTarget, bounds: CameraBounds | undefined): CameraTarget {
  const scale = clampScale(target.scale, bounds);
  if (!bounds) return { ...target, scale };
  const xy = bounds.getXYBounds
    ? bounds.getXYBounds(scale)
    : { minX: bounds.minX ?? target.x, maxX: bounds.maxX ?? target.x, minY: bounds.minY ?? target.y, maxY: bounds.maxY ?? target.y };
  return {
    ...target,
    scale,
    x: Math.min(xy.maxX, Math.max(xy.minX, target.x)),
    y: Math.min(xy.maxY, Math.max(xy.minY, target.y)),
  };
}

// Pure decision + math for whether a single active pointer's movement should pan the camera, and
// to where. Exported and unit tested directly (tests/memberPlotMobilePlacement.test.ts) so "a
// placement gesture cannot be consumed by the camera-pan handler" is verified without needing to
// exercise the full React hook: passing panEnabled=false must return null regardless of movement,
// pointer count, or drag-start state.
export function computeSinglePointerPan(
  panEnabled: boolean,
  activePointerCount: number,
  dragStart: { x: number; y: number; cameraX: number; cameraY: number } | null,
  current: { x: number; y: number },
  scale: number
): { x: number; y: number } | null {
  if (!panEnabled || activePointerCount !== 1 || !dragStart) return null;
  const dx = current.x - dragStart.x;
  const dy = current.y - dragStart.y;
  return { x: dragStart.cameraX - dx / scale, y: dragStart.cameraY - dy / scale };
}

// Pan/zoom controller for the world viewport. Pointer Events unify mouse and single-finger touch
// (both fire the same pointerdown/move/up sequence), so drag-to-pan needs no separate touch code
// path. Two simultaneous active pointers are tracked separately for pinch-zoom.
//
// `bounds` (optional, world-space x/y limits on the camera's center point) is a deliberate
// simplification: it clamps where the camera can look, not what fraction of the viewport is
// covered by content at the clamped position. A scene wants its bounds set so that even at the
// most extreme allowed pan, the surrounding filler content (not just the editable core) still
// fills the viewport -- that's a scene-composition responsibility, not this hook's.
export function useWorldCamera(
  initial: CameraTarget,
  bounds?: CameraBounds,
  options?: {
    // When false, a single active pointer no longer pans the camera (two-pointer pinch-zoom is
    // untouched). A caller sets this false while a drag-to-position gesture (e.g. placing an
    // object on a mobile grid, which has no hover state and so must use the same pointer sequence
    // a pan would) needs the pointer exclusively -- without it, panning and the caller's own
    // pointermove-driven logic fight over one gesture: the camera shifts under the finger while
    // the caller recomputes a target against that same shifting camera, so the position at
    // pointerup rarely matches where the finger actually was.
    panEnabled?: boolean;
  }
) {
  const panEnabled = options?.panEnabled ?? true;
  const [camera, setCamera] = useState<CameraTarget>(() => clampToBounds(initial, bounds));
  // "Flying" (layer-navigator jumps) gets an animated CSS transition; dragging/wheel-zoom apply
  // instantly on every event so the world tracks the pointer 1:1 with no lag.
  const [isFlying, setIsFlying] = useState(false);

  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistance = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(null);

  const flyTo = useCallback((target: CameraTarget, instant: boolean) => {
    setIsFlying(!instant);
    setCamera(clampToBounds(target, bounds));
    if (!instant) {
      // Matches the CSS transition duration applied to the world transform (see
      // KingdomScrollsWorld.tsx) -- clears the "flying" flag once the animation has finished so a
      // subsequent drag doesn't fight an active transition.
      window.setTimeout(() => setIsFlying(false), 650);
    }
  }, [bounds]);

  const panByScreenPixels = useCallback((dxPx: number, dyPx: number) => {
    setCamera((prev) => clampToBounds({ ...prev, x: prev.x - dxPx / prev.scale, y: prev.y - dyPx / prev.scale }, bounds));
  }, [bounds]);

  const zoomAt = useCallback((deltaScale: number) => {
    setCamera((prev) => ({ ...prev, scale: clampScale(prev.scale + deltaScale, bounds) }));
  }, [bounds]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Wrapped defensively: a pointer id the browser doesn't consider capturable (observed with
    // synthetic PointerEvents during testing, but not guaranteed impossible for a real stylus/
    // accessibility-tool event either) throws here and must not abort the drag below it --
    // capture is a nice-to-have (keeps receiving move events if the cursor leaves the element),
    // not a requirement for panning to work.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored -- see comment above.
    }
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y };
    } else if (activePointers.current.size === 2) {
      const [a, b] = Array.from(activePointers.current.values());
      lastPinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, [camera.x, camera.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const [a, b] = Array.from(activePointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinchDistance.current != null) {
        const ratio = distance / lastPinchDistance.current;
        setCamera((prev) => ({ ...prev, scale: clampScale(prev.scale * ratio, bounds) }));
      }
      lastPinchDistance.current = distance;
      return;
    }

    // Single-pointer panning is intentionally opt-out (not opt-in via a separate handler): the
    // pointer is still tracked in activePointers/dragStart above regardless of panEnabled, so a
    // second finger landing mid-gesture still has a correct pinch baseline. Only the *pan
    // application* itself (computeSinglePointerPan, called inside the updater below) is gated.
    //
    // Captured into locals rather than re-read as `dragStart.current!`/`activePointers.current.size`
    // inside the setCamera updater: onPointerUp can mutate those refs between this handler running
    // and React flushing the updater (they're not guaranteed to happen atomically), which
    // previously threw "Cannot read properties of null" on a real drag in testing.
    const start = dragStart.current;
    const pointerCount = activePointers.current.size;
    const current = { x: e.clientX, y: e.clientY };
    setCamera((prev) => {
      const pan = computeSinglePointerPan(panEnabled, pointerCount, start, current, prev.scale);
      return pan ? clampToBounds({ ...prev, x: pan.x, y: pan.y }, bounds) : prev;
    });
  }, [bounds, panEnabled]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    lastPinchDistance.current = null;
    if (activePointers.current.size === 0) dragStart.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCamera((prev) => ({ ...prev, scale: clampScale(prev.scale - e.deltaY * 0.0012, bounds) }));
  }, [bounds]);

  // Always publish a fully bounds-safe camera, re-derived on every render, rather than trusting
  // that every setCamera call site above already re-clamped x/y for the scale it just produced
  // (onWheel and the pinch-zoom branch above only clamp scale, not x/y, since with scale-dependent
  // bounds a zoom can shrink the safe x/y range too). This also covers the case where `bounds`
  // itself changes externally (e.g. a scene recomputing a tighter minZoom after a viewport resize)
  // -- internal state can't retroactively know that happened, but every render re-clamps against
  // whatever bounds are current, so the displayed camera can never show (or have callers reason
  // about) an out-of-bounds position, even for one stale frame.
  const displayedCamera = useMemo(() => clampToBounds(camera, bounds), [camera, bounds]);

  return { camera: displayedCamera, isFlying, flyTo, panByScreenPixels, zoomAt, onPointerDown, onPointerMove, onPointerUp, onWheel };
}
