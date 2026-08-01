import { ConnectionMask } from "./roadSystem";

// Reference masks shown in inventory/sheet previews -- illustrative only, not tied to any real
// placement. Shared by the desktop sidebar and the mobile inventory sheet so both show the exact
// same reference art. Placement itself never lets a user pick a piece type; it's always
// connection-derived (see roadSystem.ts).
export const ROAD_PREVIEW_MASKS_FOR_PICKER: ConnectionMask[] = [
  { NE: true, SE: false, SW: true, NW: false }, // straight
  { NE: true, SE: true, SW: false, NW: false }, // corner
  { NE: true, SE: true, SW: true, NW: false }, // t-junction
  { NE: true, SE: true, SW: true, NW: true }, // intersection
  { NE: true, SE: false, SW: false, NW: false }, // end
];
