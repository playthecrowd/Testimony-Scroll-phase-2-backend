// Connection-mask-driven road system for the Member Plot -- pure logic only, no rendering, no
// React (see tests/memberPlotRoadSystem.test.ts). Rewritten after the first checkpoint's CSS-based
// rotation was rejected: the earlier version stored a resolved (assetType, rotation) snapshot on
// each placement and had to manually
// re-resolve neighbors whenever an adjacent cell changed. This version stores nothing derivable --
// a placement is just {placementId, col, row, roadFamilyId, styleVariant}. The connection mask AND
// the piece-type label are both computed live, every render, directly from the current placement
// list. There is no snapshot to go stale and nothing to manually re-resolve.
//
// Directions use isometric edge labels (NE/SE/SW/NW), not screen-space compass points, to avoid
// ambiguity between "the edge a neighbor sits behind" and ordinary north/east/south/west:
// NE = (col, row-1), SE = (col+1, row), SW = (col, row+1), NW = (col-1, row) -- matching
// gridToScreen's own neighbor derivation (memberPlotSliceLayout.ts).

export type Direction = "NE" | "SE" | "SW" | "NW";
export const DIRECTIONS: Direction[] = ["NE", "SE", "SW", "NW"];

export interface ConnectionMask {
  NE: boolean;
  SE: boolean;
  SW: boolean;
  NW: boolean;
}

export type RoadAssetType = "end" | "straight" | "corner" | "t-junction" | "intersection";

export const ROAD_FAMILY_ID = "road.modern-2026";
export const ROAD_STYLE_VARIANT = "modern-2026";

export function neighborCell(col: number, row: number, d: Direction): { col: number; row: number } {
  switch (d) {
    case "NE":
      return { col, row: row - 1 };
    case "SE":
      return { col: col + 1, row };
    case "SW":
      return { col, row: row + 1 };
    case "NW":
      return { col: col - 1, row };
  }
}

const OPPOSITE: Record<Direction, Direction> = { NE: "SW", SW: "NE", SE: "NW", NW: "SE" };

export interface RoadPlacement {
  placementId: string;
  col: number;
  row: number;
  roadFamilyId: string;
  styleVariant: string;
}

// The only source of truth for a tile's visual connections: which of its 4 neighbor cells
// currently hold a road placement, checked fresh against the live placement list every time.
export function computeMaskFromNeighbors(col: number, row: number, roads: RoadPlacement[]): ConnectionMask {
  const hasRoadAt = (c: number, r: number) => roads.some((p) => p.col === c && p.row === r);
  const mask: ConnectionMask = { NE: false, SE: false, SW: false, NW: false };
  for (const d of DIRECTIONS) {
    const n = neighborCell(col, row, d);
    if (hasRoadAt(n.col, n.row)) mask[d] = true;
  }
  return mask;
}

// A label describing the mask, for data/filtering purposes only (e.g. classifying a placement for
// analytics or the future Asset Library). Rendering NEVER uses this label to pick artwork -- it
// draws directly from the ConnectionMask itself (see RoadTileSvg.tsx). This keeps the label purely
// descriptive: it can never desync from what's actually drawn, because nothing reads it to decide
// what to draw.
export function classifyMask(mask: ConnectionMask): RoadAssetType {
  const active = DIRECTIONS.filter((d) => mask[d]);
  if (active.length <= 1) return "end";
  if (active.length === 2) return OPPOSITE[active[0]] === active[1] ? "straight" : "corner";
  if (active.length === 3) return "t-junction";
  return "intersection";
}

export function placeRoad(
  col: number,
  row: number,
  roads: RoadPlacement[],
  placementIdFactory: () => string,
  roadFamilyId: string = ROAD_FAMILY_ID,
  styleVariant: string = ROAD_STYLE_VARIANT
): RoadPlacement[] {
  if (roads.some((p) => p.col === col && p.row === row)) return roads;
  return [...roads, { placementId: placementIdFactory(), col, row, roadFamilyId, styleVariant }];
}

export function removeRoad(col: number, row: number, roads: RoadPlacement[]): RoadPlacement[] {
  return roads.filter((p) => !(p.col === col && p.row === row));
}
