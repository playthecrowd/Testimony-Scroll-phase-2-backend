// Shared test scene for the rendering proof-of-concept (DOM vs PixiJS). Identical data feeds both
// renderers so the comparison is fair -- neither implementation gets an easier dataset.
//
// Scale rationale: a single member plot was specced at up to 20x20 cells, an organization land up
// to 100x100 (10,000 logical cells) but chunked so only a fraction render at once. This POC tests
// at 900 SIMULTANEOUSLY MOUNTED objects (30x30) -- deliberately more than any one visible chunk
// would ever hold in the real chunking design (§6/§9 of the approved plan), to see where each
// approach actually starts to strain, not just confirm both are fine at a trivially small count.

export interface PocObject {
  id: string;
  gridX: number;
  gridY: number;
  kind: "relic" | "building" | "decoration";
  label: string;
}

const KINDS: PocObject["kind"][] = ["relic", "building", "decoration"];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRID_SIZE = 30;
export const CELL_SIZE = 64; // logical px per grid cell
export const OBJECT_COUNT = 900;

// Deterministic (seeded), not Math.random() -- both renderers must receive byte-identical scenes
// across repeated test runs so timing differences reflect the renderer, not the data.
export function generateTestScene(): PocObject[] {
  const rand = mulberry32(42);
  const objects: PocObject[] = [];
  const occupied = new Set<string>();
  for (let i = 0; i < OBJECT_COUNT; i++) {
    let gridX: number, gridY: number, key: string;
    do {
      gridX = Math.floor(rand() * GRID_SIZE);
      gridY = Math.floor(rand() * GRID_SIZE);
      key = `${gridX},${gridY}`;
    } while (occupied.has(key));
    occupied.add(key);
    objects.push({
      id: `poc-${i}`,
      gridX,
      gridY,
      kind: KINDS[Math.floor(rand() * KINDS.length)],
      label: `Item ${i}`,
    });
  }
  return objects;
}

export const WORLD_PX = GRID_SIZE * CELL_SIZE;
