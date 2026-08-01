// Static placement data for the Upper Kingdom assembled-mockup screenshot. Same isometric grid
// math as churchLandLayout.ts, but composed as several DISCONNECTED floating islands with gaps
// (filled by cloud layers) rather than one continuous ground -- per the "multiple islands"
// requirement in docs/UPPER_KINGDOM_ART_DIRECTION.md.

export const TILE_W = 128;
export const TILE_H = 64;

export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

export interface IslandTile {
  col: number;
  row: number;
}

export interface PlacedObject {
  id: string;
  assetPath: string;
  col: number;
  row: number;
  displayWidth: number;
  displayHeight: number;
  elevationOffset?: number; // extra upward pixel offset for floating tiers
}

const ASSET = (rel: string) => `/images/kingdom-scrolls/upper-kingdom/${rel}`;

// Four island clusters: central hub + three satellites, each a compact diamond-shaped patch of
// cells, deliberately NOT tiling into one continuous grid -- the gaps are where sky/cloud shows
// through, matching "multiple islands" rather than one landmass.
function diamondPatch(centerCol: number, centerRow: number, radius: number): IslandTile[] {
  const tiles: IslandTile[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (Math.abs(dr) + Math.abs(dc) <= radius) tiles.push({ col: centerCol + dc, row: centerRow + dr });
    }
  }
  return tiles;
}

export const CENTRAL_ISLAND = diamondPatch(20, 20, 4);
export const WEST_ISLAND = diamondPatch(8, 22, 3);
export const NORTHEAST_ISLAND = diamondPatch(28, 12, 3);
export const SOUTHEAST_ISLAND = diamondPatch(30, 28, 3);
// Expansion-batch islands for the 3 newly-completed named locations.
export const SOUTHWEST_ISLAND = diamondPatch(13, 32, 3);
export const NORTH_ISLAND = diamondPatch(20, 7, 2);
export const FAR_EAST_ISLAND = diamondPatch(38, 21, 3);

export const ALL_ISLAND_TILES: IslandTile[] = [
  ...CENTRAL_ISLAND,
  ...WEST_ISLAND,
  ...NORTHEAST_ISLAND,
  ...SOUTHEAST_ISLAND,
  ...SOUTHWEST_ISLAND,
  ...NORTH_ISLAND,
  ...FAR_EAST_ISLAND,
];

export const STRUCTURES: PlacedObject[] = [
  { id: "kingdom-hub", assetPath: ASSET("buildings/upper.building.kingdom-hub.png"), col: 21, row: 21, displayWidth: 420, displayHeight: 500, elevationOffset: 40 },
  { id: "scroll-archive", assetPath: ASSET("buildings/upper.building.scroll-archive.png"), col: 9, row: 23, displayWidth: 280, displayHeight: 340 },
  { id: "wisdom-halls", assetPath: ASSET("buildings/upper.building.wisdom-halls.png"), col: 29, row: 13, displayWidth: 340, displayHeight: 320 },
  { id: "testimony-dispatch", assetPath: ASSET("buildings/upper.building.testimony-dispatch.png"), col: 31, row: 29, displayWidth: 280, displayHeight: 340 },
  { id: "training-courts", assetPath: ASSET("buildings/upper.building.training-courts.png"), col: 14, row: 33, displayWidth: 320, displayHeight: 340 },
  { id: "light-keep", assetPath: ASSET("buildings/upper.building.light-keep.png"), col: 20, row: 7, displayWidth: 260, displayHeight: 320 },
  { id: "unity-plaza", assetPath: ASSET("buildings/upper.building.unity-plaza.png"), col: 39, row: 21, displayWidth: 380, displayHeight: 420 },
  // Filler structures scattered for density, not named locations.
  { id: "midground-spire-1", assetPath: ASSET("structures/upper.structure.midground-spire.png"), col: 25, row: 22, displayWidth: 180, displayHeight: 220 },
];

// Bridges span the gaps between islands -- placed at the midpoint between each satellite and the
// central hub, oriented implicitly by the source art (a generic diagonal span asset).
export const BRIDGES: PlacedObject[] = [
  { id: "bridge-west", assetPath: ASSET("bridges/upper.bridge.celestial.png"), col: 14, row: 22, displayWidth: 260, displayHeight: 160 },
  { id: "bridge-northeast", assetPath: ASSET("bridges/upper.bridge.celestial.png"), col: 25, row: 17, displayWidth: 260, displayHeight: 160 },
  { id: "bridge-southeast", assetPath: ASSET("bridges/upper.bridge.celestial.png"), col: 26, row: 25, displayWidth: 260, displayHeight: 160 },
  { id: "bridge-southwest", assetPath: ASSET("bridges/upper.bridge.celestial.png"), col: 17, row: 28, displayWidth: 260, displayHeight: 160 },
  { id: "bridge-north", assetPath: ASSET("bridges/upper.bridge.celestial.png"), col: 20, row: 13, displayWidth: 220, displayHeight: 140 },
  { id: "bridge-far-east", assetPath: ASSET("bridges/upper.bridge.celestial.png"), col: 34, row: 24, displayWidth: 260, displayHeight: 160 },
];

export const MARKERS: PlacedObject[] = [
  { id: "mission-gateway", assetPath: ASSET("markers/upper.marker.mission-gateway.png"), col: 17, row: 22, displayWidth: 70, displayHeight: 70 },
  { id: "lesson-marker", assetPath: "/images/kingdom-scrolls/shared/markers/shared.marker.lesson.png", col: 22, row: 18, displayWidth: 60, displayHeight: 60 },
  { id: "testimony-marker", assetPath: "/images/kingdom-scrolls/shared/markers/shared.marker.testimony-mission.png", col: 30, row: 28, displayWidth: 60, displayHeight: 60 },
  { id: "lesson-portal", assetPath: ASSET("markers/upper.marker.lesson-portal.png"), col: 14, row: 32, displayWidth: 55, displayHeight: 55 },
  { id: "member-presence-1", assetPath: ASSET("markers/upper.marker.member-presence.png"), col: 39, row: 20, displayWidth: 45, displayHeight: 45 },
];

export const CLOUD_LAYERS = {
  back: ASSET("clouds/upper.cloud.back-layer.png"),
  middle: ASSET("clouds/upper.cloud.middle-layer.png"),
  foreground: ASSET("clouds/upper.cloud.foreground-layer.png"),
};

export const TERRAIN_TILE = ASSET("terrain/upper.terrain.island-base.png");
