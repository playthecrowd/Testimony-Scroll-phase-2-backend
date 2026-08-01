"use client";

import {
  TILE_W,
  TILE_H,
  gridToScreen,
  ALL_ISLAND_TILES,
  STRUCTURES,
  BRIDGES,
  MARKERS,
  CLOUD_LAYERS,
  TERRAIN_TILE,
  PlacedObject,
} from "./upperKingdomLayout";

/* eslint-disable @next/next/no-img-element */

const WORLD_W = 42 * TILE_W;
const WORLD_H = 42 * TILE_H;
const PAD_X = 1400;
const PAD_TOP = 600;
const PAD_BOTTOM = 1200; // extra room below for the cloud sea

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
        top: y - (obj.elevationOffset ?? 0),
        width: obj.displayWidth,
        height: obj.displayHeight,
        transform: "translate(-50%, -100%)",
        zIndex: 10000 + obj.row + obj.col,
        pointerEvents: "none",
      }}
    />
  );
}

export function UpperKingdomMockup() {
  const originOffset = gridToScreen(0, 0);
  const totalW = WORLD_W + PAD_X * 2;
  const totalH = WORLD_H + PAD_TOP + PAD_BOTTOM;

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      {/* Deep sky base */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0a1428 0%, #1a2340 55%, #0a1428 100%)" }} />

      {/* Back cloud layer -- furthest, lowest contrast, sits behind everything */}
      <div
        className="absolute inset-x-0"
        style={{ top: totalH * 0.15, height: 500, backgroundImage: `url(${CLOUD_LAYERS.back})`, backgroundRepeat: "repeat-x", backgroundSize: "1800px 500px", opacity: 0.5, zIndex: 1 }}
      />

      <div
        className="absolute"
        style={{ left: PAD_X - originOffset.x, top: PAD_TOP - originOffset.y, width: WORLD_W, height: WORLD_H, zIndex: 2 }}
      >
        {/* Island terrain -- each tile independently placed, gaps between islands stay empty
            (transparent), letting the sky/cloud layers show through -- this is what makes it read
            as separate floating islands rather than one continuous landmass. */}
        {ALL_ISLAND_TILES.map((t) => {
          const { x, y } = gridToScreen(t.col, t.row);
          return (
            <img
              key={`${t.col},${t.row}`}
              src={TERRAIN_TILE}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, transform: "translate(-50%, -50%)", zIndex: t.row + t.col }}
            />
          );
        })}

        {/* Gateway beam -- rising from the Kingdom Hub, matching the reference's central light shaft */}
        {(() => {
          const hub = gridToScreen(21, 21);
          return (
            <div
              className="absolute"
              style={{ left: hub.x, top: hub.y - 900, width: 3, height: 900, transform: "translateX(-50%)", zIndex: 10500 }}
            >
              <div className="w-full h-full bg-gradient-to-t from-[#fff6df]/90 via-[#d4a53d]/50 to-[#f0d68a]/0" style={{ boxShadow: "0 0 60px 20px rgba(212,165,61,0.35)" }} />
            </div>
          );
        })()}

        {BRIDGES.map((b) => (
          <Placed key={b.id} obj={b} />
        ))}
        {STRUCTURES.map((s) => (
          <Placed key={s.id} obj={s} />
        ))}
        {MARKERS.map((m) => (
          <Placed key={m.id} obj={m} />
        ))}
      </div>

      {/* Middle cloud layer -- over the islands' lower edges, under the foreground layer */}
      <div
        className="absolute inset-x-0"
        style={{ top: totalH * 0.62, height: 550, backgroundImage: `url(${CLOUD_LAYERS.middle})`, backgroundRepeat: "repeat-x", backgroundSize: "2000px 550px", opacity: 0.8, zIndex: 20000 }}
      />
      {/* Foreground cloud layer -- closest, occludes the bottom edge of the whole scene */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: 420, backgroundImage: `url(${CLOUD_LAYERS.foreground})`, backgroundRepeat: "repeat-x", backgroundSize: "2200px 420px", zIndex: 20001 }}
      />
    </div>
  );
}
