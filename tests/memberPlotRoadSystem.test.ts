import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMaskFromNeighbors,
  classifyMask,
  placeRoad,
  removeRoad,
  neighborCell,
  DIRECTIONS,
  type RoadPlacement,
} from "../components/kingdom-scrolls/mockup/memberPlotSlice/roadSystem";

let nextId = 0;
function makeId() {
  nextId += 1;
  return `road-${nextId}`;
}

test("[TRUE TEST] neighborCell direction convention matches gridToScreen's own neighbor derivation", () => {
  assert.deepEqual(neighborCell(5, 5, "NE"), { col: 5, row: 4 });
  assert.deepEqual(neighborCell(5, 5, "SE"), { col: 6, row: 5 });
  assert.deepEqual(neighborCell(5, 5, "SW"), { col: 5, row: 6 });
  assert.deepEqual(neighborCell(5, 5, "NW"), { col: 4, row: 5 });
});

test("[TRUE TEST] computeMaskFromNeighbors reads only actual adjacent placements, not diagonal or distant ones", () => {
  const roads: RoadPlacement[] = [
    { placementId: "a", col: 5, row: 4, roadFamilyId: "road.modern-2026", styleVariant: "modern-2026" }, // NE neighbor
    { placementId: "b", col: 6, row: 6, roadFamilyId: "road.modern-2026", styleVariant: "modern-2026" }, // diagonal, not adjacent
    { placementId: "c", col: 8, row: 5, roadFamilyId: "road.modern-2026", styleVariant: "modern-2026" }, // distant, same row
  ];
  const mask = computeMaskFromNeighbors(5, 5, roads);
  assert.deepEqual(mask, { NE: true, SE: false, SW: false, NW: false });
});

test("[TRUE TEST] placeRoad: first isolated segment has zero live connections and classifies as end", () => {
  const roads = placeRoad(10, 10, [], makeId);
  assert.equal(roads.length, 1);
  const mask = computeMaskFromNeighbors(10, 10, roads);
  assert.equal(classifyMask(mask), "end");
});

test("[TRUE TEST] placing a second segment adjacent to the first: both derive a live 1-connection mask (no stored state to update)", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 10, roads, makeId);
  roads = placeRoad(10, 11, roads, makeId); // SW of the first
  assert.deepEqual(computeMaskFromNeighbors(10, 10, roads), { NE: false, SE: false, SW: true, NW: false });
  assert.deepEqual(computeMaskFromNeighbors(10, 11, roads), { NE: true, SE: false, SW: false, NW: false });
});

test("[TRUE TEST] a 3-segment straight line: the middle segment's live mask classifies as straight", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 10, roads, makeId);
  roads = placeRoad(10, 11, roads, makeId);
  roads = placeRoad(10, 12, roads, makeId);
  const middleMask = computeMaskFromNeighbors(10, 11, roads);
  assert.deepEqual(middleMask, { NE: true, SE: false, SW: true, NW: false });
  assert.equal(classifyMask(middleMask), "straight");
});

test("[TRUE TEST] adding a perpendicular branch: the middle segment's live mask reclassifies as t-junction with no explicit re-resolution step", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 10, roads, makeId);
  roads = placeRoad(10, 11, roads, makeId);
  roads = placeRoad(10, 12, roads, makeId);
  roads = placeRoad(11, 11, roads, makeId); // SE of the middle segment
  assert.equal(classifyMask(computeMaskFromNeighbors(10, 11, roads)), "t-junction");
});

test("[TRUE TEST] a full 4-way surround: the center segment's live mask classifies as intersection", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 11, roads, makeId); // will become the center
  roads = placeRoad(10, 10, roads, makeId); // NE
  roads = placeRoad(11, 11, roads, makeId); // SE
  roads = placeRoad(10, 12, roads, makeId); // SW
  roads = placeRoad(9, 11, roads, makeId); // NW
  assert.equal(classifyMask(computeMaskFromNeighbors(10, 11, roads)), "intersection");
});

test("[TRUE TEST] placeRoad is a no-op when the target cell is already occupied", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 10, roads, makeId);
  const before = roads.length;
  roads = placeRoad(10, 10, roads, makeId);
  assert.equal(roads.length, before);
});

test("[TRUE TEST] removeRoad: a neighbor's live mask automatically drops the connection, no manual downgrade step needed", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 10, roads, makeId);
  roads = placeRoad(10, 11, roads, makeId);
  roads = removeRoad(10, 10, roads);
  assert.equal(roads.length, 1);
  assert.deepEqual(computeMaskFromNeighbors(10, 11, roads), { NE: false, SE: false, SW: false, NW: false });
});

test("[TRUE TEST] removeRoad: a t-junction's live mask automatically reverts to straight once its branch is removed", () => {
  let roads: RoadPlacement[] = [];
  roads = placeRoad(10, 10, roads, makeId);
  roads = placeRoad(10, 11, roads, makeId);
  roads = placeRoad(10, 12, roads, makeId);
  roads = placeRoad(11, 11, roads, makeId);
  roads = removeRoad(11, 11, roads);
  assert.equal(classifyMask(computeMaskFromNeighbors(10, 11, roads)), "straight");
});

test("[TRUE TEST] every direction is reachable and classifies correctly as an isolated end", () => {
  for (const d of DIRECTIONS) {
    const mask = { NE: false, SE: false, SW: false, NW: false, [d]: true };
    assert.equal(classifyMask(mask), "end");
  }
});
