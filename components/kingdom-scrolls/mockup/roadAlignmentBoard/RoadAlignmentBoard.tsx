"use client";

import { useMemo } from "react";
import { TILE_W, TILE_H, gridToScreen } from "../memberPlotSlice/memberPlotSliceLayout";
import { computeMaskFromNeighbors } from "../memberPlotSlice/roadSystem";
import { RoadTileSvg } from "../memberPlotSlice/RoadTileSvg";
import { buildAlignmentBoard, FIELD_SIZE } from "./roadAlignmentBoardLayout";

const GRASS_SRC = "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.grass-modern.png";

/* eslint-disable @next/next/no-img-element */

// Unlike the Member Plot (which recenters everything through a camera transform), this test board
// has no camera -- it lays tiles out directly via gridToScreen's raw output, which is negative for
// roughly half the diamond field (any cell where row > col). Without this offset, that half is
// clipped by the container's left edge instead of scrolled to. FIELD_SIZE-1 cols/rows at TILE_W/2
// px each is the largest negative x gridToScreen can produce for this field size; a little extra
// margin absorbs rounding.
function boardOffsetX(fieldSize: number): number {
  return ((fieldSize - 1) * TILE_W) / 2 + TILE_W;
}

// Standalone alignment test board -- built and rendered entirely through the same real placement
// algorithm (placeRoad) and the same real renderer (RoadTileSvg) the Member Plot uses, so passing
// this board is a genuine test of the production code path, not a hand-simulated demo.
export function RoadAlignmentBoard() {
  const { roads, labels, driveway } = useMemo(() => buildAlignmentBoard(), []);

  const terrainCells = useMemo(() => {
    const cells: { col: number; row: number }[] = [];
    for (let row = 0; row < FIELD_SIZE; row++) {
      for (let col = 0; col < FIELD_SIZE; col++) {
        cells.push({ col, row });
      }
    }
    return cells;
  }, []);

  const offsetX = boardOffsetX(FIELD_SIZE);
  function pos(col: number, row: number) {
    const { x, y } = gridToScreen(col, row);
    return { x: x + offsetX, y };
  }

  return (
    <div className="ks-theme" style={{ background: "#04060c", width: "100%", minHeight: "100vh", overflow: "auto" }}>
      <div style={{ padding: "12px 16px", color: "var(--ks-gold-light)", fontFamily: "system-ui", fontSize: 13 }}>
        Road Alignment Test Board -- built via placeRoad(), rendered via RoadTileSvg (the exact
        production code path). Zero rotation transforms anywhere on this page.
      </div>
      <div
        className="relative"
        style={{
          width: FIELD_SIZE * TILE_W + offsetX,
          height: FIELD_SIZE * TILE_H + 400,
          zoom: 0.2,
        }}
      >
        {terrainCells.map((cell) => {
          const { x, y } = pos(cell.col, cell.row);
          return (
            <img
              key={`${cell.col},${cell.row}`}
              src={GRASS_SRC}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: TILE_W,
                height: TILE_H,
                transform: "translate(-50%, -50%)",
                zIndex: cell.row + cell.col,
              }}
            />
          );
        })}

        {roads.map((r) => {
          const mask = computeMaskFromNeighbors(r.col, r.row, roads);
          const { x, y } = pos(r.col, r.row);
          return (
            <div
              key={r.placementId}
              style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, transform: "translate(-50%, -50%)", zIndex: 1000 + r.row + r.col }}
            >
              <RoadTileSvg mask={mask} width={TILE_W} height={TILE_H} />
            </div>
          );
        })}

        {/* Driveway stand-in -- a plain labeled grass cell with a marker, since no dedicated
            driveway-entrance asset exists yet (disclosed simplification, matches Phase 2A's
            "companion pieces planned, not yet built" note). */}
        <div
          style={{
            position: "absolute",
            left: pos(driveway.col, driveway.row).x,
            top: pos(driveway.col, driveway.row).y,
            width: TILE_W,
            height: TILE_H,
            transform: "translate(-50%, -50%)",
            zIndex: 1000 + driveway.row + driveway.col,
            border: "2px dashed #d4a53d",
            boxSizing: "border-box",
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }}
        />

        {labels.map((l, i) => {
          const { x, y } = pos(l.col, l.row);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x - 100,
                top: y - 40,
                width: 260,
                zIndex: 20000,
                color: "#f0d68a",
                fontFamily: "system-ui",
                fontSize: 11,
                fontWeight: 600,
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              {l.text}
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: pos(driveway.col, driveway.row).x - 100,
            top: pos(driveway.col, driveway.row).y + 30,
            width: 260,
            zIndex: 20000,
            color: "#f0d68a",
            fontFamily: "system-ui",
            fontSize: 11,
            fontWeight: 600,
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          Driveway connection point (stand-in)
        </div>
      </div>
    </div>
  );
}
