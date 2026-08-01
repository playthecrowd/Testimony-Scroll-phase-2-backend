// Static placement data for the Earth World -- 2026 assembled-mockup screenshot. Same isometric
// grid math as upperKingdomLayout.ts. Terrain/building references point at the new
// public/images/kingdom-scrolls/earth-2026/ library -- NOT the superseded earth-lands/ medieval
// set.

export const TILE_W = 128;
export const TILE_H = 64;
export const GRID_SIZE = 30;

export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

export type TerrainMaterial = "grass-modern" | "road-sidewalk" | "cloud-edge-transition" | "parking-space";

export interface TerrainCell {
  col: number;
  row: number;
  material: TerrainMaterial;
}

export interface PlacedObject {
  id: string;
  assetPath: string;
  col: number;
  row: number;
  displayWidth: number;
  displayHeight: number;
}

const ASSET = (rel: string) => `/images/kingdom-scrolls/earth-2026/${rel}`;
const SHARED = (rel: string) => `/images/kingdom-scrolls/shared/${rel}`;

export function buildTerrain(): TerrainCell[] {
  const cells: TerrainCell[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      let material: TerrainMaterial = "grass-modern";
      // North edge transitions toward the Cloud Passage / Upper Kingdom.
      if (row < 2) material = "cloud-edge-transition";
      // Central access road + parking spine.
      else if (col >= 13 && col <= 15 && row >= 6 && row <= 27) material = "road-sidewalk";
      // Cross street serving the civic row.
      else if (row >= 10 && row <= 11 && col >= 4 && col <= 24) material = "road-sidewalk";
      // Parking area beside the food-distribution center.
      else if (col >= 24 && col <= 27 && row >= 9 && row <= 10) material = "parking-space";

      cells.push({ col, row, material });
    }
  }
  return cells;
}

export const CIVIC_OBJECTS: PlacedObject[] = [
  { id: "church-hq", assetPath: ASSET("buildings/earth.building.church-hq.png"), col: 15, row: 5, displayWidth: 384, displayHeight: 420, },
  { id: "learning-pavilion", assetPath: ASSET("buildings/earth.building.learning-pavilion.png"), col: 8, row: 11, displayWidth: 300, displayHeight: 300 },
  { id: "counseling-center", assetPath: ASSET("buildings/earth.building.counseling-center.png"), col: 21, row: 11, displayWidth: 260, displayHeight: 280 },
  { id: "testimony-kiosk", assetPath: ASSET("objects/earth.object.testimony-kiosk.png"), col: 14, row: 9, displayWidth: 90, displayHeight: 110 },
  { id: "solar-structure", assetPath: ASSET("objects/earth.object.solar-structure.png"), col: 8, row: 14, displayWidth: 200, displayHeight: 140 },
  // Expansion-batch civic buildings.
  { id: "gathering-plaza", assetPath: ASSET("buildings/earth.building.gathering-plaza.png"), col: 3, row: 8, displayWidth: 340, displayHeight: 280 },
  { id: "food-distribution-center", assetPath: ASSET("buildings/earth.building.food-distribution-center.png"), col: 26, row: 8, displayWidth: 260, displayHeight: 250 },
  { id: "youth-activity-center", assetPath: ASSET("buildings/earth.building.youth-activity-center.png"), col: 26, row: 14, displayWidth: 260, displayHeight: 270 },
  { id: "apartment-plot", assetPath: ASSET("buildings/earth.building.apartment-plot.png"), col: 27, row: 20, displayWidth: 230, displayHeight: 320 },
];

export const NATURAL_OBJECTS: PlacedObject[] = [
  { id: "community-garden", assetPath: ASSET("objects/earth.object.community-garden.png"), col: 6, row: 4, displayWidth: 110, displayHeight: 110 },
  { id: "prayer-garden", assetPath: ASSET("objects/earth.object.prayer-garden.png"), col: 24, row: 5, displayWidth: 110, displayHeight: 110 },
  { id: "ev-charger-1", assetPath: ASSET("objects/earth.object.ev-charger.png"), col: 15, row: 13, displayWidth: 60, displayHeight: 90 },
  { id: "ev-charger-2", assetPath: ASSET("objects/earth.object.ev-charger.png"), col: 16, row: 13, displayWidth: 60, displayHeight: 90 },
  { id: "car-1", assetPath: ASSET("vehicles/earth.vehicle.car.png"), col: 17, row: 12, displayWidth: 90, displayHeight: 90 },
  { id: "ev-1", assetPath: ASSET("vehicles/earth.vehicle.ev.png"), col: 15, row: 14, displayWidth: 90, displayHeight: 90 },
  // Expansion-batch nature/infrastructure props.
  { id: "tree-1", assetPath: ASSET("objects/earth.object.tree.png"), col: 4, row: 12, displayWidth: 100, displayHeight: 110 },
  { id: "tree-2", assetPath: ASSET("objects/earth.object.tree.png"), col: 25, row: 16, displayWidth: 100, displayHeight: 110 },
  { id: "shrub-1", assetPath: ASSET("objects/earth.object.shrub.png"), col: 5, row: 13, displayWidth: 70, displayHeight: 70 },
  { id: "rock-1", assetPath: ASSET("objects/earth.object.rock.png"), col: 28, row: 6, displayWidth: 70, displayHeight: 70 },
  { id: "pond-1", assetPath: ASSET("objects/earth.object.pond.png"), col: 3, row: 15, displayWidth: 120, displayHeight: 110 },
  { id: "rain-garden-1", assetPath: ASSET("objects/earth.object.rain-garden.png"), col: 22, row: 6, displayWidth: 100, displayHeight: 90 },
  { id: "bike-rack-1", assetPath: ASSET("objects/earth.object.bike-rack.png"), col: 13, row: 8, displayWidth: 70, displayHeight: 60 },
  { id: "led-light-1", assetPath: ASSET("objects/earth.object.led-path-light.png"), col: 14, row: 20, displayWidth: 40, displayHeight: 60 },
  { id: "led-light-2", assetPath: ASSET("objects/earth.object.led-path-light.png"), col: 15, row: 24, displayWidth: 40, displayHeight: 60 },
  { id: "modern-sign-1", assetPath: ASSET("objects/earth.object.modern-sign.png"), col: 14, row: 6, displayWidth: 60, displayHeight: 90 },
];

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
].slice(0, 8) as MemberPlot[];

export function plotBoundaries() {
  return MEMBER_PLOTS.map((p) => ({ id: p.id, colStart: p.colStart, rowStart: p.rowStart, cols: 4, rows: 4, highlighted: p.isCoty }));
}

// Two of the eight non-Coty plots use the upgraded home tier for visual variety, matching how a
// real land-building game shows housing progression across a district rather than one repeated
// building everywhere.
const UPGRADED_HOME_PLOT_IDS = new Set(["plot-3", "plot-6"]);

export function plotObjects(plot: MemberPlot): PlacedObject[] {
  const homeAsset = UPGRADED_HOME_PLOT_IDS.has(plot.id)
    ? ASSET("buildings/earth.building.member-home-upgraded.png")
    : ASSET("buildings/earth.building.member-home-modern.png");
  const home: PlacedObject = {
    id: `${plot.id}-home`,
    assetPath: homeAsset,
    col: plot.colStart + 1,
    row: plot.rowStart + 1,
    displayWidth: 190,
    displayHeight: 190,
  };
  if (!plot.isCoty) return [home];

  return [
    home,
    { id: "coty-relic-compass", assetPath: "/images/kingdom-scrolls/earth-lands/relics/relic.call-compass.png", col: plot.colStart + 0, row: plot.rowStart + 1, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-lantern", assetPath: "/images/kingdom-scrolls/earth-lands/relics/relic.listening-lantern.png", col: plot.colStart + 0, row: plot.rowStart + 2, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-hammer", assetPath: "/images/kingdom-scrolls/earth-lands/relics/relic.faith-hammer.png", col: plot.colStart + 1, row: plot.rowStart + 3, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-scroll", assetPath: "/images/kingdom-scrolls/testimony-scroll-device.png", col: plot.colStart + 3, row: plot.rowStart + 3, displayWidth: 46, displayHeight: 46 },
    { id: "coty-relic-cornerstone", assetPath: "/images/kingdom-scrolls/earth-lands/relics/relic.cornerstone.png", col: plot.colStart + 2, row: plot.rowStart + 0, displayWidth: 46, displayHeight: 46 },
  ];
}

export const MARKERS: PlacedObject[] = [
  { id: "lesson-marker", assetPath: SHARED("markers/shared.marker.lesson.png"), col: 8, row: 10, displayWidth: 60, displayHeight: 60 },
  { id: "testimony-marker", assetPath: SHARED("markers/shared.marker.testimony-mission.png"), col: 21, row: 10, displayWidth: 60, displayHeight: 60 },
];
