"use client";

import { useEffect, useRef, useState } from "react";

export type SheetState = "closed" | "collapsed" | "half" | "expanded";

const SHEET_HEIGHT: Record<Exclude<SheetState, "closed">, string> = {
  collapsed: "84px",
  half: "50vh",
  expanded: "82vh",
};

const STATE_ORDER: SheetState[] = ["closed", "collapsed", "half", "expanded"];

// Generic mobile bottom sheet -- collapsed/half/expanded states, drag handle, close button, swipe
// down to close, internal scroll, safe-area padding, keyboard accessible (native focusable close
// button + Escape), screen-reader labeled. Used for both the Seeker Inventory sheet and the Daily
// Lesson Pavilion panel so both share one tested implementation.
export function BottomSheet({
  state,
  onStateChange,
  title,
  ariaLabel,
  children,
}: {
  state: SheetState;
  onStateChange: (next: SheetState) => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const dragStartY = useRef<number | null>(null);
  const dragStartState = useRef<SheetState>(state);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (state === "closed") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStateChange("closed");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, onStateChange]);

  if (state === "closed") return null;

  function handlePointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
    dragStartState.current = state;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored -- capture is a nice-to-have, not required for the drag to work.
    }
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (dragStartY.current == null) return;
    setDragOffset(e.clientY - dragStartY.current);
  }
  function endDrag() {
    if (dragStartY.current == null) return;
    const delta = dragOffset;
    dragStartY.current = null;
    setDragOffset(0);
    const idx = STATE_ORDER.indexOf(dragStartState.current);
    const threshold = 56;
    if (delta > threshold) onStateChange(STATE_ORDER[Math.max(0, idx - 1)]);
    else if (delta < -threshold) onStateChange(STATE_ORDER[Math.min(STATE_ORDER.length - 1, idx + 1)]);
    else onStateChange(dragStartState.current);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      className="ks-theme"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: SHEET_HEIGHT[state],
        transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
        transition: dragOffset ? "none" : "height 220ms ease",
        background: "var(--ks-panel-bottom, #10141f)",
        borderTop: "1px solid var(--ks-bronze, #8a6423)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        zIndex: 40000,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.5)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none", padding: "8px 8px 4px", cursor: "grab", flexShrink: 0 }}
      >
        <div
          aria-hidden
          style={{ width: 40, height: 4, borderRadius: 2, background: "var(--ks-bronze-dim, #6b5230)", margin: "0 auto 8px" }}
        />
        <div className="flex items-center justify-between px-2">
          <span className="ks-panel-title">{title}</span>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={() => onStateChange("closed")}
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "var(--ks-text-dim)",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>
      </div>
      <div className="qk-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 12px 16px" }}>
        {children}
      </div>
    </div>
  );
}
