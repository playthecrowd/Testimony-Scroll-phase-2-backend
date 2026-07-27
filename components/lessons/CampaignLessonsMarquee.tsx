"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CampaignLessonCard } from "./CampaignLessonCard";
import { PublishedLesson } from "@/types";

// Speeds are all px/second, eased toward smoothly rather than snapped to -- see the rAF loop below.
const DEFAULT_SCROLL_PX_PER_SECOND = 30; // gentle ambient default (cards drift left)
const EDGE_HOVER_SCROLL_PX_PER_SECOND = 90; // hovering a 25% edge zone
const HOLD_SCROLL_PX_PER_SECOND = 420; // press-and-hold on an arrow button
const CARD_STEP_PX = 276; // 260px card (w-[260px]) + 16px gap (gap-4) -- single-click arrow step
const EDGE_ZONE_FRACTION = 0.25;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// "Real" hover capability (a mouse/trackpad), not a touchscreen -- ambient auto-scroll and the
// edge-hover zones only make sense for a pointer that can rest somewhere without triggering a tap.
// Touch-only visitors get manual swipe + the arrow buttons, never ambient motion competing with a
// swipe gesture.
function hasHoverCapability(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

// Seamless bidirectional loop: the card list below is rendered twice back-to-back, so wrapping by
// exactly half the total scrollWidth in either direction lands on the visually identical position
// in the other copy -- works whether the row is drifting forward (ambient/right-edge/hold-right)
// or backward (left-edge/hold-left).
//
// The wrapped target MUST be computed before writing scrollLeft, not after: browsers clamp
// scrollLeft to a minimum of 0 (can't go negative in an LTR document), so writing a
// would-be-negative value and then checking "is scrollLeft < 0?" afterward always reads back an
// already-clamped 0 -- the wrap-to-the-end branch would then never fire, and backward motion would
// just stick at the start instead of looping.
function scrollWithWrap(el: HTMLDivElement, delta: number) {
  const singleSetWidth = el.scrollWidth / 2;
  if (singleSetWidth <= 0) {
    el.scrollLeft += delta;
    return;
  }
  let next = el.scrollLeft + delta;
  if (next < 0) next += singleSetWidth;
  else if (next >= singleSetWidth) next -= singleSetWidth;
  el.scrollLeft = next;
}

type EdgeZone = "left" | "right" | "center" | null;

// Same overflow-x-auto card row as before (unchanged card size/gap/scrollbar styling, unchanged
// section/heading around it), now with richer scroll interaction:
//  - a gentle ambient auto-scroll when the visitor isn't interacting with the row at all
//  - hovering the row's left/right 25% nudges it that direction, faster than the ambient default;
//    the center 50% pauses (same guarantee as "pause on hover")
//  - two overlay arrow buttons: click steps one card, press-and-hold scrolls continuously
//  - keyboard focus (tabbing into a card) always pauses ambient motion
//  - reduced-motion disables every *ambient* behavior (default drift + edge-hover) but leaves the
//    arrow buttons fully working, since those are explicit, user-held-and-released actions, not
//    autoplay
//  - touch-only devices never get ambient motion at all (see hasHoverCapability) -- manual swipe
//    and the arrow buttons (which work via Pointer Events on any input type) are always available
export function CampaignLessonsMarquee({ lessons }: { lessons: PublishedLesson[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [hoverCapable, setHoverCapable] = useState(hasHoverCapability);

  // Refs, not state -- read fresh every animation frame. Putting fast-changing pointer/focus state
  // here avoids restarting the rAF loop (and its closure) on every mouse move.
  const zoneRef = useRef<EdgeZone>(null);
  const focusedRef = useRef(false);
  const holdDirectionRef = useRef<"left" | "right" | null>(null);
  const velocityRef = useRef(0);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onMotionChange = () => setReducedMotion(motionQuery.matches);
    const onHoverChange = () => setHoverCapable(hoverQuery.matches);
    motionQuery.addEventListener("change", onMotionChange);
    hoverQuery.addEventListener("change", onHoverChange);
    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
      hoverQuery.removeEventListener("change", onHoverChange);
    };
  }, []);

  // One persistent loop for every scroll behavior (ambient drift, edge-hover, and press-and-hold)
  // so they can never fight each other by writing scrollLeft in the same frame. It keeps running
  // even when ambient motion is fully suppressed (reduced-motion or touch-only) because
  // press-and-hold must still work in both of those cases -- only the *ambient* contribution to
  // the target speed is gated, not the loop itself.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || lessons.length === 0) return;

    let raf: number;
    let last: number | null = null;

    const step = (now: number) => {
      if (last === null) last = now;
      const dt = Math.min((now - last) / 1000, 0.1); // clamp so a backgrounded/dropped frame can't jump far
      last = now;

      let target = 0;
      if (holdDirectionRef.current === "left") target = -HOLD_SCROLL_PX_PER_SECOND;
      else if (holdDirectionRef.current === "right") target = HOLD_SCROLL_PX_PER_SECOND;
      else if (!reducedMotion && hoverCapable) {
        if (focusedRef.current) target = 0;
        else if (zoneRef.current === "left") target = -EDGE_HOVER_SCROLL_PX_PER_SECOND;
        else if (zoneRef.current === "right") target = EDGE_HOVER_SCROLL_PX_PER_SECOND;
        else if (zoneRef.current === "center") target = 0;
        else target = DEFAULT_SCROLL_PX_PER_SECOND; // not hovering the row at all -> ambient default
      }

      // Ease toward the target speed instead of snapping to it -- smooth accel/decel as the cursor
      // crosses zone boundaries or a hold starts/stops, per "should feel smooth, not jumpy."
      velocityRef.current += (target - velocityRef.current) * Math.min(1, dt * 6);

      if (Math.abs(velocityRef.current) > 0.01 && el.scrollWidth > el.clientWidth) {
        scrollWithWrap(el, velocityRef.current * dt);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, hoverCapable, lessons.length]);

  if (lessons.length === 0) return null;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const fraction = (e.clientX - rect.left) / rect.width;
    zoneRef.current = fraction < EDGE_ZONE_FRACTION ? "left" : fraction > 1 - EDGE_ZONE_FRACTION ? "right" : "center";
  }
  function handleMouseLeave() {
    zoneRef.current = null;
  }
  function handleFocus() {
    focusedRef.current = true;
  }
  function handleBlur() {
    focusedRef.current = false;
  }
  function handleTouchStart() {
    // Reuse the same "pause" flag while an active touch/swipe is in progress, so ambient motion on
    // a hover-and-touch-capable device never fights a manual swipe.
    focusedRef.current = true;
  }
  function handleTouchEnd() {
    focusedRef.current = false;
  }

  // Single click: jump exactly one card. Deliberately instant (not native smooth-scroll) so it can
  // never fight the ambient loop's own concurrent scrollLeft writes -- the loop just continues
  // seamlessly from the new position on its next frame.
  function handleStep(direction: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    scrollWithWrap(el, direction === "left" ? -CARD_STEP_PX : CARD_STEP_PX);
  }

  function startHold(direction: "left" | "right") {
    holdDirectionRef.current = direction;
  }
  function stopHold() {
    holdDirectionRef.current = null;
  }

  // Duplicated once for the seamless-loop math above -- keys are suffixed per-copy since the same
  // lesson id appears in both halves.
  const doubled = lessons.length > 1 ? [...lessons, ...lessons] : lessons;

  const arrowButtonClassName =
    "absolute top-2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur flex items-center justify-center text-white transition-colors focus-ring";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Scroll featured lessons left"
        onClick={() => handleStep("left")}
        onPointerDown={() => startHold("left")}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className={`${arrowButtonClassName} left-2`}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Scroll featured lessons right"
        onClick={() => handleStep("right")}
        onPointerDown={() => startHold("right")}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className={`${arrowButtonClassName} right-2`}
      >
        <ChevronRight size={18} />
      </button>
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto qk-scrollbar pb-2"
        tabIndex={0}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {doubled.map((lesson, i) => (
          <CampaignLessonCard key={`${lesson.id}-${i}`} lesson={lesson} className="shrink-0 w-[260px]" />
        ))}
      </div>
    </div>
  );
}
