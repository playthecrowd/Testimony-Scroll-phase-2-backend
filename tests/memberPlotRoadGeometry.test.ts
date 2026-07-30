import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoadTileGeometry } from "../components/kingdom-scrolls/mockup/memberPlotSlice/roadGeometry";
import { DIRECTIONS, ConnectionMask, Direction, classifyMask, neighborCell } from "../components/kingdom-scrolls/mockup/memberPlotSlice/roadSystem";
import { ROAD_CONNECTION_POINT, ROAD_GROUND_CENTER, ROAD_CANVAS_W, ROAD_CANVAS_H, ROAD_HALF_WIDTH } from "../components/kingdom-scrolls/mockup/memberPlotSlice/roadTemplate";
import { gridToScreen, TILE_W, TILE_H } from "../components/kingdom-scrolls/mockup/memberPlotSlice/memberPlotSliceLayout";

function emptyMask(): ConnectionMask {
  return { NE: false, SE: false, SW: false, NW: false };
}
function maskOf(...dirs: Direction[]): ConnectionMask {
  const m = emptyMask();
  for (const d of dirs) m[d] = true;
  return m;
}

test("[TRUE TEST] every connection point sits exactly at the true midpoint toward that neighbor's tile center -- not estimated, computed", () => {
  // The canonical canvas is 2x the display tile (256x128 vs TILE_W=128,TILE_H=64), so a canvas
  // offset from center must equal exactly 2x the real 1x world-space offset to the neighbor's
  // shared edge midpoint (half the full center-to-center delta gridToScreen reports).
  const origin = gridToScreen(20, 20);
  for (const d of DIRECTIONS) {
    const neighbor = neighborCell(20, 20, d);
    const neighborCenter = gridToScreen(neighbor.col, neighbor.row);
    const fullDelta = { x: neighborCenter.x - origin.x, y: neighborCenter.y - origin.y };
    const expectedEdgeMidpointOffset1x = { x: fullDelta.x / 2, y: fullDelta.y / 2 };

    const canvasOffset = { x: ROAD_CONNECTION_POINT[d].x - ROAD_GROUND_CENTER.x, y: ROAD_CONNECTION_POINT[d].y - ROAD_GROUND_CENTER.y };
    const canvasToDisplayScale = TILE_W / ROAD_CANVAS_W; // ROAD_CANVAS_W is 2x TILE_W by construction
    const actualOffset1x = { x: canvasOffset.x * canvasToDisplayScale, y: canvasOffset.y * canvasToDisplayScale };

    assert.equal(actualOffset1x.x, expectedEdgeMidpointOffset1x.x, `${d} x offset must match the true neighbor-edge midpoint`);
    assert.equal(actualOffset1x.y, expectedEdgeMidpointOffset1x.y, `${d} y offset must match the true neighbor-edge midpoint`);
  }
});

test("[TRUE TEST] the four connection points are equidistant from the ground center (no direction is drawn shorter or longer than another)", () => {
  const distances = DIRECTIONS.map((d) => Math.hypot(ROAD_CONNECTION_POINT[d].x - ROAD_GROUND_CENTER.x, ROAD_CONNECTION_POINT[d].y - ROAD_GROUND_CENTER.y));
  for (const dist of distances) assert.equal(dist, distances[0]);
});

test("[TRUE TEST] the diamond canvas is exactly 2x TILE_W x TILE_H, matching every other terrain tile's canvas convention", () => {
  assert.equal(ROAD_CANVAS_W, TILE_W * 2);
  assert.equal(ROAD_CANVAS_H, TILE_H * 2);
});

test("[TRUE TEST] classifyMask: 0 or 1 connections is 'end'", () => {
  assert.equal(classifyMask(emptyMask()), "end");
  assert.equal(classifyMask(maskOf("NE")), "end");
});

test("[TRUE TEST] classifyMask: 2 opposite connections is 'straight', 2 adjacent is 'corner'", () => {
  assert.equal(classifyMask(maskOf("NE", "SW")), "straight");
  assert.equal(classifyMask(maskOf("NW", "SE")), "straight");
  assert.equal(classifyMask(maskOf("NE", "SE")), "corner");
  assert.equal(classifyMask(maskOf("SE", "SW")), "corner");
  assert.equal(classifyMask(maskOf("SW", "NW")), "corner");
  assert.equal(classifyMask(maskOf("NW", "NE")), "corner");
});

test("[TRUE TEST] classifyMask: 3 connections is t-junction, 4 is intersection", () => {
  assert.equal(classifyMask(maskOf("NE", "SE", "SW")), "t-junction");
  assert.equal(classifyMask(maskOf("NE", "SE", "SW", "NW")), "intersection");
});

test("[TRUE TEST] buildRoadTileGeometry produces exactly one arm per active direction, no more, no less", () => {
  for (const mask of [maskOf("NE"), maskOf("NE", "SW"), maskOf("NE", "SE", "SW"), maskOf("NE", "SE", "SW", "NW")]) {
    const g = buildRoadTileGeometry(mask);
    const activeDirs = DIRECTIONS.filter((d) => mask[d]);
    assert.equal(g.arms.length, activeDirs.length);
    assert.deepEqual(
      g.arms.map((a) => a.direction).sort(),
      activeDirs.sort()
    );
  }
});

test("[TRUE TEST] a hub is present whenever there is at least one connection, absent for zero connections", () => {
  assert.equal(buildRoadTileGeometry(emptyMask()).hub, null);
  assert.notEqual(buildRoadTileGeometry(maskOf("NE")).hub, null);
  assert.notEqual(buildRoadTileGeometry(maskOf("NE", "SE", "SW", "NW")).hub, null);
});

test("[TRUE TEST] an end cap is present only for exactly one connection, and sits exactly at that direction's connection point", () => {
  const single = buildRoadTileGeometry(maskOf("SE"));
  assert.notEqual(single.endCap, null);
  assert.deepEqual(single.endCap!.center, ROAD_CONNECTION_POINT.SE);

  const straight = buildRoadTileGeometry(maskOf("NE", "SW"));
  assert.equal(straight.endCap, null);

  const empty = buildRoadTileGeometry(emptyMask());
  assert.equal(empty.endCap, null);
});

test("[TRUE TEST] every arm's outer quad extends from the ground center to that direction's exact canonical connection point", () => {
  const g = buildRoadTileGeometry(maskOf("NE", "SE"));
  for (const arm of g.arms) {
    const cp = ROAD_CONNECTION_POINT[arm.direction];
    // outerQuad = [a,b,c,d] where a/b are near center and c/d are near the connection point.
    const nearConnectionPoints = [arm.outerQuad[2], arm.outerQuad[3]];
    for (const p of nearConnectionPoints) {
      assert.ok(Math.hypot(p.x - cp.x, p.y - cp.y) <= ROAD_HALF_WIDTH + 0.001, "quad corner near the connection point must stay within one road half-width of it");
    }
  }
});

test("[TRUE TEST] crosswalk stripes only appear once there are 3 or more connections (T-junctions and intersections)", () => {
  assert.equal(buildRoadTileGeometry(maskOf("NE", "SW")).arms.every((a) => a.crosswalk === null), true);
  assert.equal(buildRoadTileGeometry(maskOf("NE", "SE", "SW")).arms.some((a) => a.crosswalk !== null), true);
  assert.equal(buildRoadTileGeometry(maskOf("NE", "SE", "SW", "NW")).arms.every((a) => a.crosswalk !== null), true);
});

test("[TRUE TEST] no orientation requires a rotation value anywhere in the geometry output -- the shape returned is already correctly oriented per direction", () => {
  const g = buildRoadTileGeometry(maskOf("SW"));
  assert.equal("rotation" in g, false);
  for (const arm of g.arms) assert.equal("rotation" in arm, false);
});
