"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorldCamera } from "../useWorldCamera";
import { generateTestScene, GRID_SIZE, CELL_SIZE, WORLD_PX, PocObject } from "./testScene";

const KIND_COLOR: Record<PocObject["kind"], string> = {
  relic: "#d4a53d",
  building: "#6f8fc9",
  decoration: "#7fbf9e",
};

export function DomWorldPoc({ onMetrics }: { onMetrics: (m: { mountedNodes: number; mountMs: number }) => void }) {
  const objects = useMemo(() => generateTestScene(), []);
  const { camera, onPointerDown, onPointerMove, onPointerUp, onWheel } = useWorldCamera({ x: WORLD_PX / 2, y: WORLD_PX / 2, scale: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t0 = performance.now();
    // Measured on the next frame so the browser has actually painted the mounted nodes, not just
    // scheduled them -- a same-tick read (as discovered testing the real MapViewport this session)
    // would race React's commit.
    requestAnimationFrame(() => {
      const nodeCount = rootRef.current?.querySelectorAll("*").length ?? 0;
      onMetrics({ mountedNodes: nodeCount, mountMs: performance.now() - t0 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative w-full h-full overflow-hidden bg-[#0a0f1a] touch-none select-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="absolute left-1/2 top-1/2">
        <div
          className="absolute"
          style={{
            width: WORLD_PX,
            height: WORLD_PX,
            transformOrigin: "0 0",
            transform: `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`,
          }}
        >
          {/* Grid lines: ONE tiled background, not one element per cell -- this is the §3/§6
              claim under direct test here. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(212,165,61,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,165,61,0.15) 1px, transparent 1px)",
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
            }}
          />
          {objects.map((obj) => {
            const isSelected = selected === obj.id;
            return (
              <button
                key={obj.id}
                type="button"
                onClick={() => setSelected(obj.id)}
                aria-label={`${obj.label} (${obj.kind})`}
                aria-pressed={isSelected}
                className="absolute flex items-center justify-center rounded-full focus-ring transition-transform hover:scale-110"
                style={{
                  left: obj.gridX * CELL_SIZE + 4,
                  top: obj.gridY * CELL_SIZE + 4,
                  width: CELL_SIZE - 8,
                  height: CELL_SIZE - 8,
                  background: KIND_COLOR[obj.kind],
                  outline: isSelected ? "2px solid white" : "none",
                  outlineOffset: 2,
                }}
              />
            );
          })}
          {/* One mission path, drawn as a real SVG line across the grid. */}
          <svg className="absolute inset-0 pointer-events-none" width={WORLD_PX} height={WORLD_PX}>
            <line
              x1={2 * CELL_SIZE}
              y1={2 * CELL_SIZE}
              x2={(GRID_SIZE - 3) * CELL_SIZE}
              y2={(GRID_SIZE - 3) * CELL_SIZE}
              stroke="#d4a53d"
              strokeWidth={3}
              strokeDasharray="10 8"
            />
          </svg>
          {/* One animated/pulsing "gateway" object -- CSS keyframe animation. */}
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              left: (GRID_SIZE / 2) * CELL_SIZE - 20,
              top: (GRID_SIZE / 2) * CELL_SIZE - 20,
              width: 40,
              height: 40,
              background: "radial-gradient(circle, #fff3cf 0%, #d4a53d 60%, transparent 100%)",
              boxShadow: "0 0 24px 8px rgba(212,165,61,0.6)",
            }}
          />
        </div>
      </div>
      {selected && (
        <div className="absolute bottom-3 left-3 bg-black/80 text-white text-xs px-3 py-2 rounded-lg">
          Selected: {objects.find((o) => o.id === selected)?.label}
        </div>
      )}
    </div>
  );
}
