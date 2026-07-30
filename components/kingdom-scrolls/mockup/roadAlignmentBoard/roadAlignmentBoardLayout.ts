// Layout data for the road alignment test board -- required before the corrected road family is
// reintegrated into the Member Plot. Every
// cluster below is built by feeding real (col,row) cells through the SAME placeRoad() used by the
// live Member Plot, then rendered by the SAME RoadTileSvg used there -- this board exercises the
// real system, it does not hand-fake any piece type or mask.

import { placeRoad, RoadPlacement } from "../memberPlotSlice/roadSystem";

export const FIELD_SIZE = 40;

// Base grid position of each cluster, spaced generously apart so no two clusters' pieces or labels
// ever overlap, and each cluster's own cells are relative offsets from its base.
interface Cluster {
  label: string;
  base: { col: number; row: number };
  cells: { col: number; row: number }[]; // relative to base
}

const CLUSTERS: Cluster[] = [
  {
    label: "Straight -- NE–SW orientation",
    base: { col: 4, row: 4 },
    cells: [0, 1, 2, 3, 4].map((i) => ({ col: 0, row: i })),
  },
  {
    label: "Straight -- NW–SE orientation",
    base: { col: 4, row: 14 },
    cells: [0, 1, 2, 3, 4].map((i) => ({ col: i, row: 0 })),
  },
  {
    label: "Corner NE+SE",
    base: { col: 16, row: 4 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: -1 },
      { col: 1, row: 0 },
    ],
  },
  {
    label: "Corner SE+SW",
    base: { col: 16, row: 10 },
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ],
  },
  {
    label: "Corner SW+NW",
    base: { col: 16, row: 16 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
    ],
  },
  {
    label: "Corner NW+NE",
    base: { col: 16, row: 22 },
    cells: [
      { col: 0, row: 0 },
      { col: -1, row: 0 },
      { col: 0, row: -1 },
    ],
  },
  {
    label: "T-junction missing NE",
    base: { col: 24, row: 4 },
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
    ],
  },
  {
    label: "T-junction missing SE",
    base: { col: 24, row: 10 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: -1 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
    ],
  },
  {
    label: "T-junction missing SW",
    base: { col: 24, row: 16 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: -1 },
      { col: 1, row: 0 },
      { col: -1, row: 0 },
    ],
  },
  {
    label: "T-junction missing NW",
    base: { col: 24, row: 22 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: -1 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ],
  },
  {
    label: "Four-way intersection",
    base: { col: 32, row: 4 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: -1 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: -1, row: 0 },
    ],
  },
  {
    label: "Endings -- NE–SW axis (both directions)",
    base: { col: 32, row: 12 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
    ],
  },
  {
    label: "Endings -- NW–SE axis (both directions)",
    base: { col: 32, row: 18 },
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ],
  },
  {
    label: "Closed loop",
    base: { col: 4, row: 24 },
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 1, row: 2 },
      { col: 0, row: 2 },
      { col: 0, row: 1 },
    ],
  },
  {
    label: "S-shaped route",
    base: { col: 12, row: 30 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
      { col: 2, row: 3 },
      { col: 2, row: 4 },
    ],
  },
  {
    label: "Route connecting to a driveway (stand-in cell -- no driveway asset exists yet)",
    base: { col: 22, row: 30 },
    cells: [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 0, row: 2 },
    ],
  },
];

export interface BoardResult {
  roads: RoadPlacement[];
  labels: { text: string; col: number; row: number }[];
  driveway: { col: number; row: number };
}

export function buildAlignmentBoard(): BoardResult {
  let roads: RoadPlacement[] = [];
  let idCounter = 0;
  const idFactory = () => `align-${idCounter++}`;
  const labels: { text: string; col: number; row: number }[] = [];

  for (const cluster of CLUSTERS) {
    let minRow = Infinity;
    let minCol = Infinity;
    for (const c of cluster.cells) {
      const col = cluster.base.col + c.col;
      const row = cluster.base.row + c.row;
      roads = placeRoad(col, row, roads, idFactory);
      if (row < minRow) minRow = row;
      if (col < minCol) minCol = col;
    }
    labels.push({ text: cluster.label, col: minCol, row: minRow - 1 });
  }

  // The driveway stand-in: a plain labeled cell one step past the driveway cluster's last segment.
  const driveway = { col: 22, row: 33 };

  return { roads, labels, driveway };
}
