// Static placement data for the Church Land assembled-mockup screenshot. This is NOT the real
// game's data model -- it's a one-off layout for a single approval screenshot, built from the
// same isometric grid math as the render-poc (gridToScreen), reusing the officially generated
// Earth Lands assets. Nothing here is wired into the live Kingdom Scrolls route.

export const TILE_W = 128; // on-screen diamond width at 1x, per the art-direction spec §2
export const TILE_H = 64;
export const GRID_SIZE = 30;

export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

export type TerrainMaterial =
  | "grass.healthy"
  | "grass.dry"
  | "soil"
  | "soil.cultivated"
  | "path-foundation"
  | "building-foundation"
  | "stone"
  | "water.shallow"
  | "cliff-edge"
  | "locked"
  | "cloud-edge";

export interface TerrainCell {
  col: number;
  row: number;
  material: TerrainMaterial;
}

export interface PlacedObject {
  id: string;
  assetPath: string; // relative to /public
  col: number; // anchor: southernmost occupied cell
  row: number;
  footprintCols: number;
  footprintRows: number;
  displayWidth: number; // CSS px at the mockup's working scale
  displayHeight: number;
  label?: string; // small caption pill, only for the handful of named landmarks
}

export interface PlotBoundary {
  id: string;
  colStart: number;
  rowStart: number;
  cols: number;
  rows: number;
  highlighted: boolean; // Coty Elder's plot
}

// ---- Terrain: hand-authored, not random -- a deliberate "church campus" ground plan ----
// Base fill is healthy grass; specific regions get soil/path/water/cliff/locked treatment.
export function buildTerrain(): TerrainCell[] {
  const cells: TerrainCell[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      let material: TerrainMaterial = "grass.healthy";

      // Cloud-facing north edge (toward the Upper Kingdom).
      if (row < 2) material = "cloud-edge";
      // Central spine path from the gateway down through the member district.
      else if (col >= 13 && col <= 14 && row >= 6 && row <= 27) material = "path-foundation";
      // Cross path serving the civic row.
      else if (row >= 10 && row <= 11 && col >= 4 && col <= 24) material = "path-foundation";
      // Foundations under the headquarters plaza.
      else if (col >= 12 && col <= 16 && row >= 2 && row <= 6) material = "building-foundation";
      // A small pond area (south-west).
      else if (col >= 3 && col <= 5 && row >= 20 && row <= 22) material = "water.shallow";
      // Dry-grass patch breaking up uniform green (south-east, away from the pond).
      else if (col >= 22 && col <= 27 && row >= 20 && row <= 24) material = "grass.dry";
      // Cultivated-soil garden strip near the member district entrance.
      else if (col >= 8 && col <= 11 && row >= 13 && row <= 14) material = "soil.cultivated";
      // Cliff edge marking the property's east boundary.
      else if (col >= 28) material = "cliff-edge";
      // Locked expansion cells directly beside Coty Elder's plot (colStart 12-15, rowStart
      // 17-20) -- the brief asks for these to visibly belong to Coty's own plot detail, not
      // just exist somewhere on the map.
      else if (col >= 16 && col <= 17 && row >= 17 && row <= 20) material = "locked";

      cells.push({ col, row, material });
    }
  }
  return cells;
}

const ASSET = (rel: string) => `/images/kingdom-scrolls/earth-lands/${rel}`;

// ---- Civic / organization buildings ----
export const CIVIC_OBJECTS: PlacedObject[] = [
  { id: "hq", assetPath: ASSET("buildings-org/building.org.headquarters.png"), col: 15, row: 5, footprintCols: 3, footprintRows: 3, displayWidth: 384, displayHeight: 450, label: "Church Land Headquarters" },
  { id: "gateway", assetPath: ASSET("buildings-org/building.org.gateway.png"), col: 14, row: 8, footprintCols: 2, footprintRows: 1, displayWidth: 220, displayHeight: 220, label: "Organization Gateway" },
  { id: "lesson-hall", assetPath: ASSET("buildings-org/building.org.lesson-hall.png"), col: 8, row: 11, footprintCols: 3, footprintRows: 2, displayWidth: 340, displayHeight: 320, label: "Shared Lesson Hall" },
  { id: "scroll-station", assetPath: ASSET("buildings-org/building.org.scroll-station.png"), col: 21, row: 11, footprintCols: 2, footprintRows: 2, displayWidth: 260, displayHeight: 300, label: "Kingdom Scroll Station" },
  { id: "testimony-dispatch", assetPath: ASSET("buildings-org/building.org.testimony-dispatch.png"), col: 8, row: 14, footprintCols: 2, footprintRows: 2, displayWidth: 260, displayHeight: 300, label: "Testimony Dispatch" },
  { id: "mission-board", assetPath: ASSET("buildings-org/building.org.mission-board.png"), col: 21, row: 14, footprintCols: 1, footprintRows: 1, displayWidth: 130, displayHeight: 170, label: "Mission Board" },
  { id: "monument", assetPath: ASSET("buildings-org/building.org.monument.png"), col: 14, row: 10, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 170, label: "Achievement Monument" },
];

// ---- Natural decoration scattered for variation (reused prop assets, placed many times -- the
// same asset-reuse convention real isometric land-building games use for foliage) ----
export const NATURAL_OBJECTS: PlacedObject[] = [
  { id: "tree-1", assetPath: ASSET("natural/natural.tree.small.png"), col: 4, row: 4, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "tree-2", assetPath: ASSET("natural/natural.tree.small.png"), col: 6, row: 3, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "tree-3", assetPath: ASSET("natural/natural.tree.small.png"), col: 25, row: 4, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "tree-4", assetPath: ASSET("natural/natural.tree.small.png"), col: 2, row: 18, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "tree-5", assetPath: ASSET("natural/natural.tree.small.png"), col: 27, row: 17, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "tree-6", assetPath: ASSET("natural/natural.tree.small.png"), col: 6, row: 26, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "rock-1", assetPath: ASSET("natural/natural.rock.png"), col: 3, row: 9, footprintCols: 1, footprintRows: 1, displayWidth: 90, displayHeight: 90 },
  { id: "rock-2", assetPath: ASSET("natural/natural.rock.png"), col: 26, row: 9, footprintCols: 1, footprintRows: 1, displayWidth: 90, displayHeight: 90 },
  { id: "rock-3", assetPath: ASSET("natural/natural.rock.png"), col: 6, row: 21, footprintCols: 1, footprintRows: 1, displayWidth: 90, displayHeight: 90 },
  { id: "pond-1", assetPath: ASSET("natural/natural.water.pond-small.png"), col: 4, row: 21, footprintCols: 1, footprintRows: 1, displayWidth: 120, displayHeight: 120 },
  { id: "garden-1", assetPath: ASSET("natural/natural.garden.png"), col: 9, row: 13, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
  { id: "garden-2", assetPath: ASSET("natural/natural.garden.png"), col: 10, row: 14, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 110 },
];

// ---- Member district: 8 plots, 4x4 cells each, two rows of four south of the civic buildings.
// Plot index 0 is Coty Elder's -- centrally placed in the front row, not off in a corner, so it
// reads as "the player's" plot at a glance. ----
export interface MemberPlot {
  id: string;
  ownerLabel: string;
  colStart: number;
  rowStart: number;
  isCoty: boolean;
}

export const MEMBER_PLOTS: MemberPlot[] = [
  { id: "plot-0", ownerLabel: "Coty Elder", colStart: 12, rowStart: 17, isCoty: true },
  { id: "plot-1", ownerLabel: "Aaron P.", colStart: 2, rowStart: 17, isCoty: false },
  { id: "plot-2", ownerLabel: "Maya L.", colStart: 7, rowStart: 17, isCoty: false },
  { id: "plot-3", ownerLabel: "Ethan R.", colStart: 17, rowStart: 17, isCoty: false },
  { id: "plot-4", ownerLabel: "Sophia K.", colStart: 22, rowStart: 17, isCoty: false },
  { id: "plot-5", ownerLabel: "Noah T.", colStart: 2, rowStart: 23, isCoty: false },
  { id: "plot-6", ownerLabel: "Grace W.", colStart: 7, rowStart: 23, isCoty: false },
  { id: "plot-7", ownerLabel: "Liam H.", colStart: 17, rowStart: 23, isCoty: false },
  { id: "plot-8", ownerLabel: "Olivia B.", colStart: 22, rowStart: 23, isCoty: false },
].slice(0, 8) as MemberPlot[]; // exactly 8, per the requirement ("at least eight")

export function plotBoundaries(): PlotBoundary[] {
  return MEMBER_PLOTS.map((p) => ({ id: p.id, colStart: p.colStart, rowStart: p.rowStart, cols: 4, rows: 4, highlighted: p.isCoty }));
}

// Per-plot building/prop placement, relative to the plot's own colStart/rowStart (so the same
// offsets apply to every plot; Coty's gets extra objects layered in separately below).
export function plotObjects(plot: MemberPlot): PlacedObject[] {
  const home: PlacedObject = {
    id: `${plot.id}-home`,
    assetPath: ASSET("buildings-member/building.member.starter-home.png"),
    col: plot.colStart + 1,
    row: plot.rowStart + 1,
    footprintCols: 2,
    footprintRows: 2,
    displayWidth: 190,
    displayHeight: 205,
  };
  const tree: PlacedObject = {
    id: `${plot.id}-tree`,
    assetPath: ASSET("natural/natural.tree.small.png"),
    col: plot.colStart + 3,
    row: plot.rowStart,
    footprintCols: 1,
    footprintRows: 1,
    displayWidth: 90,
    displayHeight: 90,
  };
  if (!plot.isCoty) return [home, tree];

  // Coty's plot: the full detail set the spec requires -- lesson pavilion, personal scroll
  // station, relic storage, and the six starter relics visible as small ground-placed props.
  return [
    home,
    tree,
    { id: "coty-pavilion", assetPath: ASSET("buildings-member/building.member.lesson-pavilion.png"), col: plot.colStart + 0, row: plot.rowStart + 3, footprintCols: 1, footprintRows: 1, displayWidth: 130, displayHeight: 140 },
    { id: "coty-scroll-station", assetPath: ASSET("buildings-member/building.member.scroll-station.png"), col: plot.colStart + 2, row: plot.rowStart + 3, footprintCols: 1, footprintRows: 1, displayWidth: 110, displayHeight: 130 },
    { id: "coty-relic-storage", assetPath: ASSET("buildings-member/building.member.relic-storage.png"), col: plot.colStart + 3, row: plot.rowStart + 2, footprintCols: 1, footprintRows: 1, displayWidth: 90, displayHeight: 100 },
    { id: "coty-relic-compass", assetPath: ASSET("relics/relic.call-compass.png"), col: plot.colStart + 0, row: plot.rowStart + 1, footprintCols: 1, footprintRows: 1, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-lantern", assetPath: ASSET("relics/relic.listening-lantern.png"), col: plot.colStart + 0, row: plot.rowStart + 2, footprintCols: 1, footprintRows: 1, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-hammer", assetPath: ASSET("relics/relic.faith-hammer.png"), col: plot.colStart + 1, row: plot.rowStart + 3, footprintCols: 1, footprintRows: 1, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-scroll", assetPath: ASSET("testimony-scroll-device.png"), col: plot.colStart + 3, row: plot.rowStart + 3, footprintCols: 1, footprintRows: 1, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-cornerstone", assetPath: ASSET("relics/relic.cornerstone.png"), col: plot.colStart + 2, row: plot.rowStart + 0, footprintCols: 1, footprintRows: 1, displayWidth: 46, displayHeight: 46 },
  ];
}

// ---- Markers ----
export const MARKERS: PlacedObject[] = [
  { id: "lesson-marker", assetPath: ASSET("markers/marker.lesson.available.png"), col: 8, row: 10, footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64, label: "Daily Lesson" },
];
