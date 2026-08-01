// Pure geometry computation for a road tile, given only its connection mask -- no rendering, no
// React, so the actual math (arm polygons, hub, end-cap, crosswalk, lane line) is directly unit
// testable (tests/memberPlotRoadGeometry.test.ts) per "do not estimate alignment by eye": every
// coordinate here is derived from roadTemplate.ts's canonical constants, nothing is hand-tuned per
// direction or per piece type. RoadTileSvg.tsx does nothing but map this data to SVG elements.

import { ConnectionMask, DIRECTIONS, Direction } from "./roadSystem";
import {
  ROAD_GROUND_CENTER,
  ROAD_CONNECTION_POINT,
  ROAD_HALF_WIDTH,
  ROAD_CURB_WIDTH,
  ROAD_END_CAP_RADIUS,
  ROAD_VERTEX_TOP,
  ROAD_VERTEX_RIGHT,
  ROAD_VERTEX_BOTTOM,
  ROAD_VERTEX_LEFT,
  perpendicular,
  offsetPoint,
  Point,
} from "./roadTemplate";

export interface ArmGeometry {
  direction: Direction;
  // Outer (curb-width) and inner (pavement-width) quads, both center -> connection point, so the
  // inner fill drawn on top of the outer leaves exactly a ROAD_CURB_WIDTH border visible.
  outerQuad: Point[];
  innerQuad: Point[];
  // Lane-divider line endpoints, pulled in slightly from both the hub and the connection point so
  // the dash pattern doesn't visually collide with the hub cap or an end cap.
  laneLine: [Point, Point];
  // Only present when this arm is part of a 3+ way junction.
  crosswalk: Point[] | null;
}

export interface RoadTileGeometry {
  diamond: Point[];
  activeCount: number;
  arms: ArmGeometry[];
  hub: { outerRadius: number; innerRadius: number } | null;
  endCap: { center: Point; outerRadius: number; innerRadius: number } | null;
}

function quad(center: Point, connectionPoint: Point, halfWidth: number): Point[] {
  const perp = perpendicular(center, connectionPoint);
  const a = offsetPoint(center, perp, halfWidth);
  const b = offsetPoint(center, perp, -halfWidth);
  const c = offsetPoint(connectionPoint, perp, -halfWidth);
  const d = offsetPoint(connectionPoint, perp, halfWidth);
  return [a, b, c, d];
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function buildRoadTileGeometry(mask: ConnectionMask): RoadTileGeometry {
  const active = DIRECTIONS.filter((d) => mask[d]);
  const activeCount = active.length;
  const center = ROAD_GROUND_CENTER;

  const arms: ArmGeometry[] = active.map((direction) => {
    const cp = ROAD_CONNECTION_POINT[direction];
    const outerQuad = quad(center, cp, ROAD_HALF_WIDTH);
    const innerQuad = quad(center, cp, ROAD_HALF_WIDTH - ROAD_CURB_WIDTH);
    const laneLine: [Point, Point] = [lerp(center, cp, 0.22), lerp(center, cp, activeCount === 1 ? 0.72 : 0.95)];
    const crosswalk = activeCount >= 3 ? crosswalkQuad(center, cp) : null;
    return { direction, outerQuad, innerQuad, laneLine, crosswalk };
  });

  const hub = activeCount >= 1 ? { outerRadius: ROAD_HALF_WIDTH, innerRadius: ROAD_HALF_WIDTH - ROAD_CURB_WIDTH } : null;

  const endCap =
    activeCount === 1
      ? { center: ROAD_CONNECTION_POINT[active[0]], outerRadius: ROAD_END_CAP_RADIUS, innerRadius: ROAD_END_CAP_RADIUS - ROAD_CURB_WIDTH }
      : null;

  return {
    diamond: [ROAD_VERTEX_TOP, ROAD_VERTEX_RIGHT, ROAD_VERTEX_BOTTOM, ROAD_VERTEX_LEFT],
    activeCount,
    arms,
    hub,
    endCap,
  };
}

function crosswalkQuad(center: Point, connectionPoint: Point): Point[] {
  const t = 0.42;
  const mid = lerp(center, connectionPoint, t);
  const perp = perpendicular(center, connectionPoint);
  const halfStripe = 4; // along the travel direction
  const dir = { x: connectionPoint.x - center.x, y: connectionPoint.y - center.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const unit = { x: dir.x / len, y: dir.y / len };
  const a = offsetPoint(offsetPoint(mid, unit, -halfStripe), perp, ROAD_HALF_WIDTH - ROAD_CURB_WIDTH);
  const b = offsetPoint(offsetPoint(mid, unit, -halfStripe), perp, -(ROAD_HALF_WIDTH - ROAD_CURB_WIDTH));
  const c = offsetPoint(offsetPoint(mid, unit, halfStripe), perp, -(ROAD_HALF_WIDTH - ROAD_CURB_WIDTH));
  const d = offsetPoint(offsetPoint(mid, unit, halfStripe), perp, ROAD_HALF_WIDTH - ROAD_CURB_WIDTH);
  return [a, b, c, d];
}
