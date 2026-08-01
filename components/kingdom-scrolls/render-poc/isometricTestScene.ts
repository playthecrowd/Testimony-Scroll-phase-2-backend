// Test scene for the isometric-grid rendering POC. Separate from testScene.ts (which tests a plain
// square grid for the DOM-vs-Canvas comparison) -- this one specifically exercises isometric
// projection math and painter's-algorithm depth sorting, the two things that are new risk for
// assembling a real Church Land from many tiles + multi-cell-footprint buildings, versus
// Checkpoint 1's absolutely-positioned markers over one flat image.

export interface IsoTile {
  col: number;
  row: number;
  material: "grass" | "soil" | "stone" | "water";
}

export interface IsoObject {
  id: string;
  col: number; // anchor cell (south-most occupied cell, per the art-direction spec's anchor rule)
  row: number;
  footprintCols: number;
  footprintRows: number;
  kind: "building" | "prop";
  label: string;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 40x40 -- larger than the 30x30/900-object DOM-vs-Canvas POC, deliberately: that POC measured
// scattered single-cell objects, this one measures a FULLY TILED ground (every one of 1,600 cells
// draws a tile, not a sparse scatter) plus ~100 multi-cell buildings on top, closer to what one
// fully-rendered, unchunked Church Land screen actually asks the renderer to do at once.
export const ISO_GRID_SIZE = 40;
export const ISO_TILE_W = 128; // on-screen diamond width at 1x, per the art-direction spec (halved for the POC's default zoom)
export const ISO_TILE_H = 64;

const MATERIALS: IsoTile["material"][] = ["grass", "grass", "grass", "soil", "stone", "water"];

export function generateIsoTerrain(): IsoTile[] {
  const rand = mulberry32(7);
  const tiles: IsoTile[] = [];
  for (let row = 0; row < ISO_GRID_SIZE; row++) {
    for (let col = 0; col < ISO_GRID_SIZE; col++) {
      tiles.push({ col, row, material: MATERIALS[Math.floor(rand() * MATERIALS.length)] });
    }
  }
  return tiles;
}

const FOOTPRINTS: [number, number][] = [
  [1, 1],
  [2, 2],
  [3, 2],
  [2, 3],
];

// 100 objects with real multi-cell footprints, deliberately allowed to overlap in placement (the
// POC's job is to prove draw order still resolves correctly even when footprints are dense/
// adjacent, not to prove a placement-validity system -- that's a gameplay concern, not a rendering
// one).
export function generateIsoObjects(): IsoObject[] {
  const rand = mulberry32(99);
  const objects: IsoObject[] = [];
  for (let i = 0; i < 100; i++) {
    const [footprintCols, footprintRows] = FOOTPRINTS[Math.floor(rand() * FOOTPRINTS.length)];
    const col = Math.floor(rand() * (ISO_GRID_SIZE - footprintCols));
    const row = Math.floor(rand() * (ISO_GRID_SIZE - footprintRows));
    objects.push({
      id: `iso-obj-${i}`,
      col,
      row,
      footprintCols,
      footprintRows,
      kind: footprintCols * footprintRows >= 4 ? "building" : "prop",
      label: `Object ${i} (${footprintCols}x${footprintRows})`,
    });
  }
  return objects;
}

// Grid (col, row) -> screen (x, y) for a 2:1 diamond projection, per §2 of the art-direction spec.
export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (ISO_TILE_W / 2),
    y: (col + row) * (ISO_TILE_H / 2),
  };
}
