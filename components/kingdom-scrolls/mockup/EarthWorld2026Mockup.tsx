"use client";

import {
  TILE_W,
  TILE_H,
  gridToScreen,
  buildTerrain,
  CIVIC_OBJECTS,
  NATURAL_OBJECTS,
  MEMBER_PLOTS,
  plotBoundaries,
  plotObjects,
  MARKERS,
  PlacedObject,
} from "./earthWorld2026Layout";

const TERRAIN_SRC: Record<string, string> = {
  "grass-modern": "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.grass-modern.png",
  "road-sidewalk": "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.road-sidewalk.png",
  "cloud-edge-transition": "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.grass-modern.png",
  "parking-space": "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.parking-space.png",
};

/* eslint-disable @next/next/no-img-element */

function Placed({ obj }: { obj: PlacedObject }) {
  const { x, y } = gridToScreen(obj.col, obj.row);
  return (
    <img
      src={obj.assetPath}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: obj.displayWidth,
        height: obj.displayHeight,
        transform: "translate(-50%, -100%)",
        zIndex: 10000 + obj.row + obj.col,
        pointerEvents: "none",
      }}
    />
  );
}

export function EarthWorld2026Mockup() {
  const terrain = buildTerrain();
  const boundaries = plotBoundaries();
  const allObjects: PlacedObject[] = [...CIVIC_OBJECTS, ...NATURAL_OBJECTS, ...MEMBER_PLOTS.flatMap((p) => plotObjects(p)), ...MARKERS];

  const worldW = 30 * TILE_W;
  const worldH = 30 * TILE_H;
  const originOffset = gridToScreen(0, 0);

  return (
    <div className="relative" style={{ width: worldW + 2000, height: worldH + 800 }}>
      <div
        className="absolute"
        style={{ left: 1000 - originOffset.x, top: 200 - originOffset.y, width: worldW + 2000, height: worldH + 800 }}
      >
        {terrain.map((cell) => {
          const { x, y } = gridToScreen(cell.col, cell.row);
          return (
            <img
              key={`${cell.col},${cell.row}`}
              src={TERRAIN_SRC[cell.material]}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, transform: "translate(-50%, -50%)", zIndex: cell.row + cell.col }}
            />
          );
        })}

        <svg className="absolute" style={{ left: -1000, top: -800, zIndex: 5000, pointerEvents: "none" }} width={30 * TILE_W + 2000} height={30 * TILE_H + 1600}>
          <g transform="translate(1000, 800)">
            {Array.from({ length: 31 }, (_, i) => {
              const a = gridToScreen(i, 0);
              const b = gridToScreen(i, 30);
              const c = gridToScreen(0, i);
              const d = gridToScreen(30, i);
              return (
                <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d4a53d" strokeOpacity={0.1} strokeWidth={1} />
                  <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="#d4a53d" strokeOpacity={0.1} strokeWidth={1} />
                </g>
              );
            })}

            {(() => {
              const p1 = gridToScreen(0, 0);
              const p2 = gridToScreen(30, 0);
              const p3 = gridToScreen(30, 30);
              const p4 = gridToScreen(0, 30);
              return <polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`} fill="none" stroke="#f0d68a" strokeWidth={3} strokeDasharray="14 10" strokeOpacity={0.55} />;
            })()}

            {boundaries.map((b) => {
              const p1 = gridToScreen(b.colStart, b.rowStart);
              const p2 = gridToScreen(b.colStart + b.cols, b.rowStart);
              const p3 = gridToScreen(b.colStart + b.cols, b.rowStart + b.rows);
              const p4 = gridToScreen(b.colStart, b.rowStart + b.rows);
              return (
                <polygon
                  key={b.id}
                  points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                  fill={b.highlighted ? "#f0d68a" : "transparent"}
                  fillOpacity={b.highlighted ? 0.06 : 0}
                  stroke={b.highlighted ? "#f0d68a" : "#8a6423"}
                  strokeWidth={b.highlighted ? 3 : 1.5}
                  strokeOpacity={b.highlighted ? 0.9 : 0.45}
                />
              );
            })}

            {(() => {
              const from = gridToScreen(15, 9);
              const to = gridToScreen(21, 12);
              return <polyline points={`${from.x},${from.y} ${to.x},${to.y}`} fill="none" stroke="#fff6df" strokeWidth={4} strokeDasharray="4 10" strokeLinecap="round" opacity={0.85} />;
            })()}

            {(() => {
              const cell = gridToScreen(13, 18);
              const pts = [
                [cell.x, cell.y - TILE_H / 2],
                [cell.x + TILE_W / 2, cell.y],
                [cell.x, cell.y + TILE_H / 2],
                [cell.x - TILE_W / 2, cell.y],
              ];
              return <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="#d4a53d" fillOpacity={0.28} stroke="#f0d68a" strokeWidth={2} />;
            })()}
          </g>
        </svg>

        {allObjects.map((obj) => (
          <Placed key={obj.id} obj={obj} />
        ))}

        {/* Cloud Passage connection toward the Upper Kingdom, at the north edge. */}
        <div className="absolute pointer-events-none" style={{ left: -1000, top: -800, width: 30 * TILE_W + 2000, height: 700, zIndex: 9000 }}>
          <div className="w-full h-full bg-gradient-to-b from-[#0a1428] via-[#0a1428]/40 to-transparent" />
          <div
            className="absolute bottom-0 w-40 h-64 -translate-x-1/2 bg-gradient-to-t from-[#f0d68a]/0 via-[#d4a53d]/40 to-[#d4a53d]/0 blur-3xl"
            style={{ left: 1000 + gridToScreen(15, 6).x }}
          />
        </div>
      </div>
    </div>
  );
}
