"use client";

import { CameraTarget, WorldLevel, WORLD_WIDTH, WORLD_HEIGHT, UPPER_KINGDOM_LOCATIONS, MIN_ZOOM, MAX_ZOOM } from "@/lib/kingdomScrollsWorld";

const MAP_W = 128;
const MAP_H = 128;

function toMapX(worldX: number) {
  return (worldX / WORLD_WIDTH) * MAP_W;
}
function toMapY(worldY: number) {
  return (worldY / WORLD_HEIGHT) * MAP_H;
}

// Schematic, not photographic -- abstract position dots and a viewport rectangle computed from
// the real, live camera state already driving the main map, never a static decorative image.
export function MiniMap({ camera, level, viewportSizePx }: { camera: CameraTarget; level: WorldLevel; viewportSizePx: { width: number; height: number } }) {
  // The visible world-space extent at the current zoom, centered on camera.x/y -- mirrors the
  // exact transform math in MapViewport.tsx so the rectangle is never out of sync with what's
  // actually on screen.
  const visibleWorldW = viewportSizePx.width / camera.scale;
  const visibleWorldH = viewportSizePx.height / camera.scale;
  const rectX = toMapX(camera.x - visibleWorldW / 2);
  const rectY = toMapY(camera.y - visibleWorldH / 2);
  const rectW = Math.max(4, toMapX(visibleWorldW));
  const rectH = Math.max(4, toMapY(visibleWorldH));

  return (
    <div className="ks-panel p-1.5" style={{ width: MAP_W + 12, height: MAP_H + 12 }}>
      <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="Mini-map">
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#050a14" />
        {/* Upper Kingdom band */}
        <rect x={0} y={0} width={MAP_W} height={toMapY(1500)} fill="#1a2338" opacity={0.6} />
        {/* Earth Lands band */}
        <rect x={0} y={toMapY(1700)} width={MAP_W} height={MAP_H - toMapY(1700)} fill="#141f14" opacity={0.6} />

        {UPPER_KINGDOM_LOCATIONS.map((loc) => (
          <circle key={loc.key} cx={toMapX(loc.x)} cy={toMapY(loc.y)} r={1.6} fill="#d4a53d" />
        ))}

        {/* Live viewport rectangle -- clamped to the map bounds so a zoomed-out camera doesn't
            draw a rectangle bigger than the map itself. */}
        <rect
          x={Math.max(0, rectX)}
          y={Math.max(0, rectY)}
          width={Math.min(rectW, MAP_W)}
          height={Math.min(rectH, MAP_H)}
          fill="none"
          stroke="#f0d68a"
          strokeWidth={1}
        />
      </svg>
      <p className="text-center text-[9px] uppercase tracking-wide mt-1" style={{ color: "var(--ks-text-dim)" }}>
        {level === "upper" ? "Upper Kingdom" : level === "land" ? "Church Land" : "My Plot"} · {clampZoomLabel(camera.scale)}
      </p>
    </div>
  );
}

function clampZoomLabel(scale: number) {
  const pct = Math.round(((scale - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);
  return `${Math.max(0, Math.min(100, pct))}%`;
}
