"use client";

import {
  TILE_W,
  TILE_H,
  FIELD_SIZE,
  gridToScreen,
  isInCore,
  isInLockedStrip,
  buildTerrain,
  FIXED_OBJECTS,
  PATH_CELLS,
  NEIGHBOR_SILHOUETTES,
  FixedObject,
  ENV_WIDTH,
  ENV_HEIGHT,
  ENV_CENTER_X,
  ENV_CENTER_Y,
} from "./memberPlotSliceLayout";
import { PlacedObject, Rotation } from "./usePlotPlacements";
import { getPlaceableDef } from "./placeableCatalog";
import { RoadPlacement, computeMaskFromNeighbors } from "./roadSystem";
import { RoadTileSvg } from "./RoadTileSvg";

/* eslint-disable @next/next/no-img-element */

const TERRAIN_SRC: Record<string, string> = {
  grass: "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.grass-modern.png",
  road: "/images/kingdom-scrolls/earth-2026/terrain/earth.terrain.road-sidewalk.png",
};
const LOCKED_OVERLAY = "/images/kingdom-scrolls/shared/states/shared.state.locked-overlay.png";
const SELECTED_CELL = "/images/kingdom-scrolls/shared/ui/shared.ui.selected-cell-state.png";

export const FIELD_PX_W = FIELD_SIZE * TILE_W;
export const FIELD_PX_H = FIELD_SIZE * TILE_H;

export interface Ghost {
  assetId: string;
  col: number;
  row: number;
  rotation: Rotation;
  valid: boolean;
}

function Diamond({ col, row, className, style }: { col: number; row: number; className?: string; style?: React.CSSProperties }) {
  const { x, y } = gridToScreen(col, row);
  return (
    <div
      className={className}
      style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, transform: "translate(-50%, -50%)", ...style }}
    />
  );
}

function FixedObjectImg({ obj }: { obj: FixedObject }) {
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
        opacity: obj.opacity ?? 1,
        filter: obj.grayscale ? "grayscale(70%) brightness(0.75)" : undefined,
        pointerEvents: "none",
      }}
    />
  );
}

export interface RoadGhost {
  col: number;
  row: number;
  valid: boolean;
}

export function MemberPlotSlice({
  showGrid,
  placements,
  ghost,
  selectedInstanceId,
  roads,
  roadGhost,
}: {
  showGrid: boolean;
  placements: PlacedObject[];
  ghost: Ghost | null;
  selectedInstanceId: string | null;
  roads: RoadPlacement[];
  roadGhost: RoadGhost | null;
}) {
  const terrain = buildTerrain();

  // The overscan backdrop below needs TWO stacked background-repeat layers, not one: a single
  // axis-aligned background-repeat at TILE_W x TILE_H only reaches grid cells where col+row is
  // EVEN (the lattice reachable from tile (0,0) via whole (Delta-col,Delta-row)=(+1,-1)/(+1,+1)
  // steps requires (col+row) to stay even) -- the odd-parity half of the isometric stagger is left
  // as transparent gaps, which read as a black-and-grass checkerboard once this backdrop is the
  // only thing behind the viewport's outer edges. A second layer, seeded from tile (1,0) (whose
  // top-left corner happens to land exactly at world (0,0)) and tiled the same way, covers exactly
  // the other parity; together they reproduce the full stagger with no gaps and no overlap (the two
  // parities' diamonds never occupy the same pixels).
  const PADDED_ENV_W = ENV_WIDTH * 1.02;
  const PADDED_ENV_H = ENV_HEIGHT * 1.02;
  const envDivLeft = ENV_CENTER_X - PADDED_ENV_W / 2;
  const envDivTop = ENV_CENTER_Y - PADDED_ENV_H / 2;
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  // Layer A: tile (0,0), top-left at world (-TILE_W/2, -TILE_H/2).
  const bgPosAX = mod(-TILE_W / 2 - envDivLeft, TILE_W);
  const bgPosAY = mod(-TILE_H / 2 - envDivTop, TILE_H);
  // Layer B: tile (1,0), top-left at world (0, 0).
  const bgPosBX = mod(-envDivLeft, TILE_W);
  const bgPosBY = mod(-envDivTop, TILE_H);

  // Deliberately no padded sub-wrapper div here (an earlier version had one, offsetting every
  // tile by a fixed (padX,padY) that the camera math in the harness didn't account for -- "center
  // on the core" was silently off by that same fixed amount, which is what actually caused the
  // exposed black corner, not a rendering performance issue). Every tile below is positioned by
  // gridToScreen(col,row) directly, in the exact same world-coordinate space as camera.x/y in
  // MemberPlotSliceHarness.tsx -- there is exactly one coordinate system in this scene.
  // Explicit large width/height, NOT a tight-fitting box: this is the containing block every
  // absolutely-positioned child's `max-width: 100%` (Tailwind preflight) resolves against. A
  // small/zero declared size here caps every image's rendered width to near-nothing regardless of
  // its own inline width style -- the exact zero-width bug already hit and fixed once earlier
  // this session (ChurchLandMockup.tsx) -- so this must stay comfortably larger than any single
  // placed asset's own pixel width (max ~400px), not sized to the scene's content extent.
  return (
    <div className="relative" style={{ width: 6000, height: 6000 }}>
        {/* Environmental overscan backdrop -- a seamless tiled repeat of the SAME grass texture used
            for individual terrain tiles below, not a solid-color fill. It's what makes the
            responsive camera minimum zoom (a "cover" fit against ENV_WIDTH x ENV_HEIGHT, computed
            in MemberPlotSliceHarness.tsx) actually safe: without real art extending past the 40x40
            diamond field's edges (and past its own bounding-box corners, which the diamond doesn't
            fill), zooming out to the cover scale would expose empty space there instead of terrain.
            The isometric diamond tile lattice is exactly reproducible as an axis-aligned CSS
            background-repeat at TILE_W x TILE_H: two grid steps in col or row each map to
            axis-aligned (TILE_W,0)/(0,TILE_H) screen vectors (see computeCoverMinZoom's comment in
            memberPlotSliceLayout.ts), so this tiles seamlessly with the individually-placed terrain
            tiles below it -- there's no visible seam between "designed field" and "procedural
            backdrop." Sized 2% beyond ENV_WIDTH/HEIGHT purely as sub-pixel/rounding safety margin;
            the actual coverage guarantee comes from the cover-scale math, not this extra size. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: envDivLeft,
            top: envDivTop,
            width: PADDED_ENV_W,
            height: PADDED_ENV_H,
            backgroundImage: `url(${TERRAIN_SRC.grass}), url(${TERRAIN_SRC.grass})`,
            backgroundRepeat: "repeat, repeat",
            backgroundSize: `${TILE_W}px ${TILE_H}px, ${TILE_W}px ${TILE_H}px`,
            backgroundPosition: `${bgPosAX}px ${bgPosAY}px, ${bgPosBX}px ${bgPosBY}px`,
            zIndex: -1,
          }}
        />

        {/* Terrain -- fully tiled, no gaps, so cover-framing + camera bounds never expose black
            space (unlike the Upper Kingdom's deliberate island gaps). */}
        {terrain.map((cell) => (
          <img
            key={`${cell.col},${cell.row}`}
            src={TERRAIN_SRC[cell.material]}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: gridToScreen(cell.col, cell.row).x,
              top: gridToScreen(cell.col, cell.row).y,
              width: TILE_W,
              height: TILE_H,
              transform: "translate(-50%, -50%)",
              zIndex: cell.row + cell.col,
            }}
          />
        ))}

        {/* Roads -- placed on top of the grass terrain tile at the same cell (flat, center-anchored,
            same convention as terrain), z-indexed just above the terrain layer so they visibly
            replace grass at that cell without needing to remove the underlying terrain tile.
            Rendered procedurally (RoadTileSvg) from a live-derived connection mask -- NEVER via
            CSS rotation of a finished bitmap. Every tile draws itself flat, in its own correctly
            oriented geometry, directly from which of its 4 neighbor cells currently hold a road.
            The earlier rotated-bitmap approach was rejected because it visually "stood up"
            non-square isometric art. */}
        {roads.map((r) => {
          const mask = computeMaskFromNeighbors(r.col, r.row, roads);
          const { x, y } = gridToScreen(r.col, r.row);
          return (
            <div key={r.placementId} style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, transform: "translate(-50%, -50%)", zIndex: 100 + r.row + r.col }}>
              <RoadTileSvg mask={mask} width={TILE_W} height={TILE_H} />
            </div>
          );
        })}

        {/* Road placement ghost -- a simple valid/invalid cell highlight (not a live preview of the
            exact resolved piece/rotation, which is only known once placed) -- a disclosed
            simplification for this checkpoint. */}
        {roadGhost && (
          <Diamond
            col={roadGhost.col}
            row={roadGhost.row}
            style={{
              zIndex: 19000,
              pointerEvents: "none",
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              background: roadGhost.valid ? "rgba(95,138,69,0.45)" : "rgba(200,60,50,0.45)",
              border: `2px solid ${roadGhost.valid ? "#7fbf6a" : "#e05a4a"}`,
              boxSizing: "border-box",
            }}
          />
        )}

        {/* Locked-expansion overlay -- real grass underneath, dark scrim + lock glyph on top, so
            it reads as "real land you haven't unlocked" rather than a technical dead zone. */}
        {terrain
          .filter((c) => isInLockedStrip(c.col, c.row))
          .map((cell) => (
            <img
              key={`locked-${cell.col},${cell.row}`}
              src={LOCKED_OVERLAY}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: gridToScreen(cell.col, cell.row).x,
                top: gridToScreen(cell.col, cell.row).y,
                width: TILE_W,
                height: TILE_H,
                transform: "translate(-50%, -50%)",
                zIndex: 5000 + cell.row + cell.col,
                pointerEvents: "none",
              }}
            />
          ))}

        {/* Subtle grid -- hidden during normal exploration, shown in Build mode. Every cell in the
            editable core gets a faint diamond outline; locked/exterior cells stay ungridded so the
            grid visually communicates "this is the editable area." */}
        {showGrid &&
          terrain
            .filter((c) => isInCore(c.col, c.row))
            .map((cell) => (
              <Diamond
                key={`grid-${cell.col},${cell.row}`}
                col={cell.col}
                row={cell.row}
                style={{
                  zIndex: 6000,
                  border: "1.5px solid rgba(240,214,138,0.7)",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                }}
              />
            ))}

        {/* Neighbor silhouettes -- desaturated, reduced-opacity, non-interactive scene dressing. */}
        {NEIGHBOR_SILHOUETTES.map((n) => (
          <FixedObjectImg key={n.id} obj={n} />
        ))}

        {/* Personal path */}
        {PATH_CELLS.map((c, i) => (
          <img
            key={`path-${i}`}
            src={TERRAIN_SRC.road}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: gridToScreen(c.col, c.row).x,
              top: gridToScreen(c.col, c.row).y,
              width: TILE_W,
              height: TILE_H,
              transform: "translate(-50%, -50%)",
              zIndex: 4000 + c.row + c.col,
            }}
          />
        ))}

        {/* Fixed plot furniture */}
        {FIXED_OBJECTS.map((o) => (
          <FixedObjectImg key={o.id} obj={o} />
        ))}

        {/* Placed relics -- real, persisted (localStorage) placements */}
        {placements.map((p) => {
          const def = getPlaceableDef(p.assetId);
          if (!def) return null;
          const { x, y } = gridToScreen(p.col, p.row);
          const isSelected = p.instanceId === selectedInstanceId;
          return (
            // Explicit width/height on this wrapper -- without it, the div has no in-flow content
            // (both children are themselves position:absolute) so its auto width computes to 0,
            // which caps every child img's rendered width to 0 via Tailwind's `max-width: 100%`
            // preflight rule. Same bug class as the earlier zero-width terrain-tile fix
            // (ChurchLandMockup.tsx) and the ghost wrapper just below.
            <div key={p.instanceId} style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, zIndex: 12000 + p.row + p.col }}>
              {isSelected && (
                <img
                  src={SELECTED_CELL}
                  alt=""
                  draggable={false}
                  style={{ position: "absolute", width: TILE_W, height: TILE_H, transform: "translate(-50%, -50%)" }}
                />
              )}
              <img
                src={def.assetPath}
                alt={def.label}
                draggable={false}
                style={{
                  position: "absolute",
                  width: def.displayWidth,
                  height: def.displayHeight,
                  transform: `translate(-50%, -90%) rotate(${p.rotation}deg)`,
                }}
              />
            </div>
          );
        })}

        {/* Placement ghost -- semi-transparent preview snapped to the hovered cell, tinted by
            valid/invalid state. */}
        {ghost &&
          (() => {
            const def = getPlaceableDef(ghost.assetId);
            if (!def) return null;
            const { x, y } = gridToScreen(ghost.col, ghost.row);
            return (
              <div style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, zIndex: 20000, pointerEvents: "none" }}>
                <div
                  style={{
                    position: "absolute",
                    width: TILE_W,
                    height: TILE_H,
                    transform: "translate(-50%, -50%)",
                    clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                    background: ghost.valid ? "rgba(95,138,69,0.45)" : "rgba(200,60,50,0.45)",
                    border: `2px solid ${ghost.valid ? "#7fbf6a" : "#e05a4a"}`,
                    boxSizing: "border-box",
                  }}
                />
                <img
                  src={def.assetPath}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    width: def.displayWidth,
                    height: def.displayHeight,
                    transform: `translate(-50%, -90%) rotate(${ghost.rotation}deg)`,
                    opacity: 0.65,
                  }}
                />
              </div>
            );
          })()}
    </div>
  );
}
