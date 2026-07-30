"use client";

import { useId } from "react";
import { ConnectionMask } from "./roadSystem";
import { buildRoadTileGeometry } from "./roadGeometry";
import {
  ROAD_CANVAS_W,
  ROAD_CANVAS_H,
  ROAD_COLOR_PAVEMENT,
  ROAD_COLOR_SIDEWALK,
  ROAD_COLOR_CURB,
  ROAD_COLOR_LANE_LINE,
  ROAD_COLOR_CROSSWALK,
  ROAD_LANE_DASH,
  ROAD_LANE_STROKE_WIDTH,
} from "./roadTemplate";

function pointsAttr(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

// Renders a road tile FLAT, in its own fixed ground-plane orientation, directly from a connection
// mask -- never via CSS/canvas rotation of a finished bitmap (rotating a non-square isometric tile
// bitmap within a fixed-aspect box squashes it, reading as a tilted card rather than a flat tile).
// Every one of the 16 possible masks renders correctly from this single
// component -- there is no per-piece-type branch and no rotation prop anywhere in this file.
export function RoadTileSvg({ mask, width, height }: { mask: ConnectionMask; width: number; height: number }) {
  const g = buildRoadTileGeometry(mask);
  // A unique id per instance is required -- a hardcoded id here produced dozens of duplicate SVG
  // ids on the alignment board (one road tile per placement), which is invalid SVG and made the
  // page's filter resolution pathologically slow. useId() guarantees uniqueness per rendered tile.
  const filterId = `ks-road-shadow-${useId()}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${ROAD_CANVAS_W} ${ROAD_CANVAS_H}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="3" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <polygon points={pointsAttr(g.diamond)} fill={ROAD_COLOR_SIDEWALK} />

        {g.activeCount > 0 &&
          g.arms.map((arm) => (
            <polygon key={`${arm.direction}-outer`} points={pointsAttr(arm.outerQuad)} fill={ROAD_COLOR_CURB} />
          ))}
        {g.hub && <circle cx={ROAD_CANVAS_W / 2} cy={ROAD_CANVAS_H / 2} r={g.hub.outerRadius} fill={ROAD_COLOR_CURB} />}

        {g.arms.map((arm) => (
          <polygon key={`${arm.direction}-inner`} points={pointsAttr(arm.innerQuad)} fill={ROAD_COLOR_PAVEMENT} />
        ))}
        {g.hub && <circle cx={ROAD_CANVAS_W / 2} cy={ROAD_CANVAS_H / 2} r={g.hub.innerRadius} fill={ROAD_COLOR_PAVEMENT} />}

        {g.endCap && (
          <>
            <circle cx={g.endCap.center.x} cy={g.endCap.center.y} r={g.endCap.outerRadius} fill={ROAD_COLOR_CURB} />
            <circle cx={g.endCap.center.x} cy={g.endCap.center.y} r={g.endCap.innerRadius} fill={ROAD_COLOR_PAVEMENT} />
          </>
        )}

        {g.arms.map((arm) => (
          <line
            key={`${arm.direction}-lane`}
            x1={arm.laneLine[0].x}
            y1={arm.laneLine[0].y}
            x2={arm.laneLine[1].x}
            y2={arm.laneLine[1].y}
            stroke={ROAD_COLOR_LANE_LINE}
            strokeWidth={ROAD_LANE_STROKE_WIDTH}
            strokeDasharray={ROAD_LANE_DASH.join(" ")}
            strokeLinecap="round"
          />
        ))}

        {g.arms
          .filter((arm) => arm.crosswalk)
          .map((arm) => (
            <polygon key={`${arm.direction}-crosswalk`} points={pointsAttr(arm.crosswalk!)} fill={ROAD_COLOR_CROSSWALK} />
          ))}
      </g>
    </svg>
  );
}
