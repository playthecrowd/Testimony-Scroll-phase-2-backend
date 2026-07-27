"use client";

import { useCallback, useRef, useState } from "react";
import { CameraTarget, clampZoom } from "@/lib/kingdomScrollsWorld";

// Pan/zoom controller for the world viewport. Pointer Events unify mouse and single-finger touch
// (both fire the same pointerdown/move/up sequence), so drag-to-pan needs no separate touch code
// path. Two simultaneous active pointers are tracked separately for pinch-zoom.
export function useWorldCamera(initial: CameraTarget) {
  const [camera, setCamera] = useState<CameraTarget>(initial);
  // "Flying" (layer-navigator jumps) gets an animated CSS transition; dragging/wheel-zoom apply
  // instantly on every event so the world tracks the pointer 1:1 with no lag.
  const [isFlying, setIsFlying] = useState(false);

  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistance = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(null);

  const flyTo = useCallback((target: CameraTarget, instant: boolean) => {
    setIsFlying(!instant);
    setCamera({ ...target, scale: clampZoom(target.scale) });
    if (!instant) {
      // Matches the CSS transition duration applied to the world transform (see
      // KingdomScrollsWorld.tsx) -- clears the "flying" flag once the animation has finished so a
      // subsequent drag doesn't fight an active transition.
      window.setTimeout(() => setIsFlying(false), 650);
    }
  }, []);

  const panByScreenPixels = useCallback((dxPx: number, dyPx: number) => {
    setCamera((prev) => ({ ...prev, x: prev.x - dxPx / prev.scale, y: prev.y - dyPx / prev.scale }));
  }, []);

  const zoomAt = useCallback((deltaScale: number) => {
    setCamera((prev) => ({ ...prev, scale: clampZoom(prev.scale + deltaScale) }));
  }, []);

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
        setCamera((prev) => ({ ...prev, scale: clampZoom(prev.scale * ratio) }));
      }
      lastPinchDistance.current = distance;
      return;
    }

    // Captured into a local const rather than re-read as `dragStart.current!` inside the setCamera
    // updater below: onPointerUp can null out the ref between this handler running and React
    // flushing the updater (they're not guaranteed to happen atomically), which previously threw
    // "Cannot read properties of null" on a real drag in testing.
    const start = dragStart.current;
    if (start) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setCamera((prev) => ({ ...prev, x: start.cameraX - dx / prev.scale, y: start.cameraY - dy / prev.scale }));
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    lastPinchDistance.current = null;
    if (activePointers.current.size === 0) dragStart.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCamera((prev) => ({ ...prev, scale: clampZoom(prev.scale - e.deltaY * 0.0012) }));
  }, []);

  return { camera, isFlying, flyTo, panByScreenPixels, zoomAt, onPointerDown, onPointerMove, onPointerUp, onWheel };
}
