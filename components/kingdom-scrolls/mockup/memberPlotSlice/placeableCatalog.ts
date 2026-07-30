// The 6 initial Lesson Relics as placeable objects for the Member Plot vertical slice. Real
// generated assets -- 5 already shipped from earlier checkpoints, "unity-cord" generated
// alongside this feature (see docs/EARTH_WORLD_2026_ART_DIRECTION.md's relic-reuse note: relics
// are portable Kingdom Scrolls items, not Earth-World architecture, so they intentionally keep
// their existing bronze/gold rendering rather than being regenerated in the "modern 2026" style).
//
// This is a development fixture list, not the real 48-relic catalog or real ownership data -- see
// usePlotPlacements.ts's own header for the persistence-layer honesty note.

export interface PlaceableDef {
  assetId: string;
  label: string;
  assetPath: string;
  footprintCols: number;
  footprintRows: number;
  displayWidth: number;
  displayHeight: number;
}

const RELIC = (rel: string) => `/images/kingdom-scrolls/earth-lands/relics/${rel}`;

export const PLACEABLE_CATALOG: PlaceableDef[] = [
  { assetId: "call-compass", label: "Call Compass", assetPath: RELIC("relic.call-compass.png"), footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64 },
  { assetId: "listening-lantern", label: "Listening Lantern", assetPath: RELIC("relic.listening-lantern.png"), footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64 },
  { assetId: "faith-hammer", label: "Faith Hammer", assetPath: RELIC("relic.faith-hammer.png"), footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64 },
  { assetId: "testimony-scroll", label: "Testimony Scroll", assetPath: "/images/kingdom-scrolls/testimony-scroll-device.png", footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64 },
  { assetId: "cornerstone", label: "Cornerstone", assetPath: RELIC("relic.cornerstone.png"), footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64 },
  { assetId: "unity-cord", label: "Unity Cord", assetPath: RELIC("relic.unity-cord.png"), footprintCols: 1, footprintRows: 1, displayWidth: 64, displayHeight: 64 },
];

export function getPlaceableDef(assetId: string): PlaceableDef | undefined {
  return PLACEABLE_CATALOG.find((p) => p.assetId === assetId);
}
