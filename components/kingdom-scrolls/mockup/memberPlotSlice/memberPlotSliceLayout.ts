// Layout for the Member Plot Vertical Slice prototype -- the first checkpoint of the hybrid
// grid+art system (per the 2026-07-28 clarification: the logical grid is core product
// functionality, never replaced by a static background). Every placeable relic sits on a real
// (col,row) grid cell; fixed scene furniture (home, pavilion, trees, path) also sits on real grid
// cells, just not user-movable in this first slice.
//
// World layout, in local plot-grid coordinates:
//  - A 30x30 fully-tiled terrain field (NO gaps -- unlike the Upper Kingdom's deliberate island
//    gaps) so that camera bounds can guarantee the viewport never exposes empty space, per the
//    "correct the empty-space problem without removing the grid" instruction.
//  - A 10x10 EDITABLE core (the member's own land) centered in that field, cols 10-19 / rows 10-19.
//  - A 4x10 locked-expansion strip immediately east of the core (cols 20-23), rendered as a dark
//    scrim + lock glyph over ordinary grass -- not a separate "locked terrain" texture, so it
//    still reads as real land the member could unlock, not a technical dead zone.
//  - Neighbor-plot silhouettes (desaturated, reduced-opacity home shapes) scattered outside the
//    core, reading as "other members' land" without claiming to be real neighbor data.
//  - A road loop around the core, matching "surrounding roads and neighboring scenery."

export const TILE_W = 128;
export const TILE_H = 64;
// Larger than the strict minimum needed for the 10x10 core + locked strip -- gives camera bounds
// (see MemberPlotSliceHarness.tsx) enough safety margin that even at this scene's zoomed-out
// extreme, the rectangular viewport's corners never reach past the tiled diamond into empty space.
export const FIELD_SIZE = 40;

export const CORE_COL_START = 15;
export const CORE_ROW_START = 15;
export const CORE_SIZE = 10; // 10x10 editable member grid, per spec

export const LOCKED_COL_START = CORE_COL_START + CORE_SIZE; // 20
export const LOCKED_COLS = 4;

export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

// Screen point -> world point -> nearest grid cell, inverting gridToScreen's own transform. Pure
// and camera-state-explicit (not read from a live ref) so it can be unit tested against a fixed
// camera snapshot -- see tests/memberPlotMobilePlacement.test.ts, which uses this to prove that a
// camera drifting mid-gesture (the Phase 1 mobile placement regression: panning and placement
// fought over the same single-finger pointer sequence) produces a different cell for the same
// physical finger position than a held-still camera does, and that a held-still camera produces a
// stable, correct cell across a multi-step drag.
export function screenToGrid(
  clientX: number,
  clientY: number,
  viewportRect: { left: number; top: number; width: number; height: number },
  camera: { x: number; y: number; scale: number }
): { col: number; row: number } {
  const sx = clientX - viewportRect.left - viewportRect.width / 2;
  const sy = clientY - viewportRect.top - viewportRect.height / 2;
  const worldX = camera.x + sx / camera.scale;
  const worldY = camera.y + sy / camera.scale;
  const col = Math.round(worldX / TILE_W + worldY / TILE_H);
  const row = Math.round(worldY / TILE_H - worldX / TILE_W);
  return { col, row };
}

// Screen-space bounding diamond of the full FIELD_SIZE terrain field: a rotated square with
// half-width DIAMOND_HALF_WIDTH, half-height DIAMOND_HALF_HEIGHT, centered at (0, DIAMOND_CENTER_Y)
// -- derived directly from gridToScreen's own corner cases (col=0/FIELD_SIZE-1 x row=0/FIELD_SIZE-1).
export const DIAMOND_HALF_WIDTH = (FIELD_SIZE * TILE_W) / 2;
export const DIAMOND_HALF_HEIGHT = (FIELD_SIZE * TILE_H) / 2;
export const DIAMOND_CENTER_Y = ((FIELD_SIZE - 1) * TILE_H) / 2;

// Environmental overscan: a real, rendered backdrop (see MemberPlotSlice.tsx's tiled grass-texture
// layer) that extends beyond the diamond field's own bounding box. This is what the camera's
// responsive minimum zoom is measured against -- not the bare diamond -- because the diamond's
// corners (the triangular gaps between the diamond and its own bounding rectangle) would otherwise
// still read as empty space at any zoom wide enough to reveal them. 15% is enough margin to absorb
// rounding/sub-pixel drift and leave a little pan slack at minimum zoom, without zooming out so far
// that the 10x10 core and its designed surroundings become visually insignificant.
const ENV_OVERSCAN_FACTOR = 1.15;
export const ENV_WIDTH = DIAMOND_HALF_WIDTH * 2 * ENV_OVERSCAN_FACTOR;
export const ENV_HEIGHT = DIAMOND_HALF_HEIGHT * 2 * ENV_OVERSCAN_FACTOR;
export const ENV_CENTER_X = 0;
export const ENV_CENTER_Y = DIAMOND_CENTER_Y;

// The "cover" scale (same semantics as CSS background-size: cover): the SMALLEST scale at which
// the ENV_WIDTH x ENV_HEIGHT backdrop still fully covers a viewportWidth x viewportHeight
// rectangle in BOTH dimensions at once. This *is* the camera's minimum allowed zoom -- anything
// smaller and at least one dimension under-covers, exposing empty space at that edge regardless of
// pan position. Must be recomputed whenever the viewport's measured size changes (resize, the
// inventory panel opening/closing, orientation change) -- see MemberPlotSliceHarness.tsx's
// ResizeObserver. A fixed minZoom constant tuned for one window size is exactly the bug this
// replaces: it was verified safe at one scale/viewport combination and silently exposed a black
// corner the first time either changed.
export function computeCoverMinZoom(viewportWidth: number, viewportHeight: number): number {
  return Math.max(viewportWidth / ENV_WIDTH, viewportHeight / ENV_HEIGHT);
}

// Pan bounds AT A GIVEN SCALE: how far the camera's center point may move from the environment's
// center while the viewport rectangle still stays fully inside the ENV_WIDTH x ENV_HEIGHT
// backdrop. At the cover scale (computeCoverMinZoom's result) this collapses to zero in whichever
// dimension was the binding constraint -- there is no slack left in that direction, matching cover
// semantics exactly -- and opens up again as the camera zooms in. Bounds are meant to be
// recalculated fresh at the CURRENT scale on every camera update, not solved once for a single
// worst-case zoom level the way the old fixed-margin approach did.
export function computeXYBoundsAtScale(
  scale: number,
  viewportWidth: number,
  viewportHeight: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const dx = Math.max(0, ENV_WIDTH / 2 - viewportWidth / (2 * scale));
  const dy = Math.max(0, ENV_HEIGHT / 2 - viewportHeight / (2 * scale));
  return { minX: ENV_CENTER_X - dx, maxX: ENV_CENTER_X + dx, minY: ENV_CENTER_Y - dy, maxY: ENV_CENTER_Y + dy };
}

export function isInCore(col: number, row: number): boolean {
  return col >= CORE_COL_START && col < CORE_COL_START + CORE_SIZE && row >= CORE_ROW_START && row < CORE_ROW_START + CORE_SIZE;
}

export function isInLockedStrip(col: number, row: number): boolean {
  return col >= LOCKED_COL_START && col < LOCKED_COL_START + LOCKED_COLS && row >= CORE_ROW_START && row < CORE_ROW_START + CORE_SIZE;
}

export type TerrainMaterial = "grass" | "road";

export interface TerrainCell {
  col: number;
  row: number;
  material: TerrainMaterial;
}

const ROAD_RING_INSET = 1; // road tiles this many cells outside the core+locked-strip footprint

export function buildTerrain(): TerrainCell[] {
  const cells: TerrainCell[] = [];
  const roadColMin = CORE_COL_START - ROAD_RING_INSET;
  const roadColMax = LOCKED_COL_START + LOCKED_COLS + ROAD_RING_INSET - 1;
  const roadRowMin = CORE_ROW_START - ROAD_RING_INSET;
  const roadRowMax = CORE_ROW_START + CORE_SIZE + ROAD_RING_INSET - 1;

  for (let row = 0; row < FIELD_SIZE; row++) {
    for (let col = 0; col < FIELD_SIZE; col++) {
      const onRoadRing =
        (col === roadColMin || col === roadColMax) && row >= roadRowMin && row <= roadRowMax ||
        (row === roadRowMin || row === roadRowMax) && col >= roadColMin && col <= roadColMax;
      cells.push({ col, row, material: onRoadRing ? "road" : "grass" });
    }
  }
  return cells;
}

export interface FixedObject {
  id: string;
  assetPath: string;
  col: number;
  row: number;
  displayWidth: number;
  displayHeight: number;
  opacity?: number;
  grayscale?: boolean;
}

const EARTH = (rel: string) => `/images/kingdom-scrolls/earth-2026/${rel}`;

// Fixed plot furniture -- real assets, positioned within the 10x10 core, not user-movable in this
// first slice (per spec: these are the plot's existing infrastructure, distinct from the
// placeable relic inventory).
export const FIXED_OBJECTS: FixedObject[] = [
  { id: "home", assetPath: EARTH("buildings/earth.building.member-home-modern.png"), col: CORE_COL_START + 2, row: CORE_ROW_START + 2, displayWidth: 200, displayHeight: 210 },
  // Reused from the org-scale Community Learning Pavilion at reduced display size -- no dedicated
  // small "personal" pavilion asset exists yet; disclosed honestly rather than silently implying
  // a bespoke member-scale asset.
  { id: "lesson-pavilion", assetPath: EARTH("buildings/earth.building.learning-pavilion.png"), col: CORE_COL_START + 6, row: CORE_ROW_START + 2, displayWidth: 140, displayHeight: 160 },
  // Reused from the civic Digital Testimony Scroll kiosk -- already object-scale, thematically
  // exact fit for a "personal Testimony Scroll station."
  { id: "scroll-station", assetPath: EARTH("objects/earth.object.testimony-kiosk.png"), col: CORE_COL_START + 6, row: CORE_ROW_START + 5, displayWidth: 55, displayHeight: 65 },
  { id: "tree-1", assetPath: EARTH("objects/earth.object.tree.png"), col: CORE_COL_START + 1, row: CORE_ROW_START + 6, displayWidth: 75, displayHeight: 80 },
  { id: "tree-2", assetPath: EARTH("objects/earth.object.tree.png"), col: CORE_COL_START + 8, row: CORE_ROW_START + 7, displayWidth: 75, displayHeight: 80 },
  { id: "shrub-1", assetPath: EARTH("objects/earth.object.shrub.png"), col: CORE_COL_START + 3, row: CORE_ROW_START + 1, displayWidth: 50, displayHeight: 50 },
];

// Personal path -- a single-file line of the road/sidewalk tile from the home to the plot's road
// edge. Reuses the road-sidewalk terrain tile rather than a dedicated "personal path" asset
// (disclosed -- no bespoke path tile exists yet).
export const PATH_CELLS: { col: number; row: number }[] = Array.from({ length: 3 }, (_, i) => ({
  col: CORE_COL_START + 2,
  row: CORE_ROW_START + 3 + i,
}));

// Neighbor-plot silhouettes -- reduced-opacity, desaturated home shapes outside the core, reading
// as "other members' land" for scene density without claiming to be real neighbor data.
export const NEIGHBOR_SILHOUETTES: FixedObject[] = [
  { id: "neighbor-1", assetPath: EARTH("buildings/earth.building.member-home-modern.png"), col: CORE_COL_START - 4, row: CORE_ROW_START + 2, displayWidth: 150, displayHeight: 158, opacity: 0.55, grayscale: true },
  { id: "neighbor-2", assetPath: EARTH("buildings/earth.building.member-home-modern.png"), col: CORE_COL_START - 4, row: CORE_ROW_START + 6, displayWidth: 150, displayHeight: 158, opacity: 0.55, grayscale: true },
  { id: "neighbor-3", assetPath: EARTH("buildings/earth.building.apartment-plot.png"), col: CORE_COL_START + 3, row: CORE_ROW_START - 4, displayWidth: 130, displayHeight: 180, opacity: 0.5, grayscale: true },
  { id: "neighbor-4", assetPath: EARTH("buildings/earth.building.member-home-upgraded.png"), col: CORE_COL_START + 12, row: CORE_ROW_START + 3, displayWidth: 160, displayHeight: 190, opacity: 0.5, grayscale: true },
  { id: "distant-tree-1", assetPath: EARTH("objects/earth.object.tree.png"), col: CORE_COL_START - 3, row: CORE_ROW_START - 3, displayWidth: 60, displayHeight: 64, opacity: 0.7 },
  { id: "distant-tree-2", assetPath: EARTH("objects/earth.object.tree.png"), col: CORE_COL_START + 13, row: CORE_ROW_START - 2, displayWidth: 60, displayHeight: 64, opacity: 0.7 },
  { id: "distant-tree-3", assetPath: EARTH("objects/earth.object.tree.png"), col: CORE_COL_START - 2, row: CORE_ROW_START + 13, displayWidth: 60, displayHeight: 64, opacity: 0.7 },
];
