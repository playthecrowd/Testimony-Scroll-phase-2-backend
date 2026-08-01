// Canonical road-tile template. Every road orientation is drawn from these exact numbers -- no
// value here is eyeballed, and every road piece (regardless of how many connections it has) is
// generated from this SAME template, so connection points, lane width, and sidewalk treatment are
// mathematically identical across every tile, not just visually similar.

import { Direction } from "./roadSystem";

// Matches the canvas size already locked for every other terrain tile (grass, road-sidewalk) --
// see docs/MEMBER_PLOT_VISUAL_SPEC_PHASE2A.md #2/#12.
export const ROAD_CANVAS_W = 256;
export const ROAD_CANVAS_H = 128;

export interface Point {
  x: number;
  y: number;
}

// The diamond's 4 vertices, filling the canvas edge-to-edge with zero padding (same rule as every
// other terrain tile).
export const ROAD_VERTEX_TOP: Point = { x: ROAD_CANVAS_W / 2, y: 0 };
export const ROAD_VERTEX_RIGHT: Point = { x: ROAD_CANVAS_W, y: ROAD_CANVAS_H / 2 };
export const ROAD_VERTEX_BOTTOM: Point = { x: ROAD_CANVAS_W / 2, y: ROAD_CANVAS_H };
export const ROAD_VERTEX_LEFT: Point = { x: 0, y: ROAD_CANVAS_H / 2 };

// The ground-plane center every road arm originates from -- exact canvas center.
export const ROAD_GROUND_CENTER: Point = { x: ROAD_CANVAS_W / 2, y: ROAD_CANVAS_H / 2 };

// The connection point on each of the 4 diamond edges -- the exact midpoint of that edge. This is
// the single most important guarantee in the whole template: because every piece computes this
// same midpoint from the same canvas geometry (never estimated per-asset), two adjacent tiles'
// arms always meet at pixel-identical positions, regardless of which combination of arms either
// tile draws.
export const ROAD_CONNECTION_POINT: Record<Direction, Point> = {
  NE: midpoint(ROAD_VERTEX_TOP, ROAD_VERTEX_RIGHT),
  SE: midpoint(ROAD_VERTEX_RIGHT, ROAD_VERTEX_BOTTOM),
  SW: midpoint(ROAD_VERTEX_BOTTOM, ROAD_VERTEX_LEFT),
  NW: midpoint(ROAD_VERTEX_LEFT, ROAD_VERTEX_TOP),
};

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Perpendicular-to-travel half-width of the paved arm, in canvas px. Total paved width = 2x this.
export const ROAD_HALF_WIDTH = 15;
// Stroke width of the curb line outlining each paved arm.
export const ROAD_CURB_WIDTH = 2;
// Lane-divider dash pattern (canvas px): [dash length, gap length].
export const ROAD_LANE_DASH: [number, number] = [8, 6];
export const ROAD_LANE_STROKE_WIDTH = 3;
// Radius of the decorative cap drawn at a genuine dead end's single connection point.
export const ROAD_END_CAP_RADIUS = ROAD_HALF_WIDTH;

// Locked palette -- pavement and sidewalk reuse the already-approved Earth World 2026 tokens
// (docs/EARTH_WORLD_2026_ART_DIRECTION.md #4); lane/crosswalk colors are new, standard road-marking
// tones chosen to NOT reuse the UI/relic gold accent (that token is reserved for UI chrome and
// equipped relics only, never architecture, per that document's own palette rule).
export const ROAD_COLOR_PAVEMENT = "#3a3d42"; // --ew-asphalt
export const ROAD_COLOR_SIDEWALK = "#c9c6bd"; // --ew-concrete
export const ROAD_COLOR_CURB = "#8a8478"; // --el-stone
export const ROAD_COLOR_LANE_LINE = "#f2f2f0";
export const ROAD_COLOR_CROSSWALK = "#e8c93a";

// A perpendicular unit vector to the direction from `from` to `to`, used to offset a travel-line
// into a paved strip of ROAD_HALF_WIDTH on each side.
export function perpendicular(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

export function offsetPoint(p: Point, perp: Point, distance: number): Point {
  return { x: p.x + perp.x * distance, y: p.y + perp.y * distance };
}
