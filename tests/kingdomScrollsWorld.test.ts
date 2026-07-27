import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  CAMERA_PRESETS,
  getPlotOffset,
  getPlotCameraTarget,
  getPlotWorldPosition,
  LAND_CENTER,
} from "../lib/kingdomScrollsWorld";

const REPO_ROOT = path.join(__dirname, "..");
function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("[TRUE TEST] clampZoom clamps below MIN_ZOOM and above MAX_ZOOM, passes values in range through unchanged", () => {
  assert.equal(clampZoom(MIN_ZOOM - 1), MIN_ZOOM);
  assert.equal(clampZoom(MAX_ZOOM + 1), MAX_ZOOM);
  assert.equal(clampZoom(1), 1);
});

test("[TRUE TEST] every world level has a camera preset within the valid zoom range", () => {
  for (const level of ["upper", "land", "plot"] as const) {
    const preset = CAMERA_PRESETS[level];
    assert.ok(preset, `expected a camera preset for "${level}"`);
    assert.ok(preset.scale >= MIN_ZOOM && preset.scale <= MAX_ZOOM, `${level} preset scale ${preset.scale} is out of [${MIN_ZOOM}, ${MAX_ZOOM}]`);
  }
});

test("[TRUE TEST] getPlotOffset is deterministic -- the same profile id always produces the same offset", () => {
  const a = getPlotOffset("00000000-0000-0000-0000-000000000001");
  const b = getPlotOffset("00000000-0000-0000-0000-000000000001");
  assert.deepEqual(a, b);
});

test("[TRUE TEST] getPlotOffset gives different profile ids visibly different offsets (not everyone stacked on one point)", () => {
  const a = getPlotOffset("00000000-0000-0000-0000-000000000001");
  const b = getPlotOffset("11111111-1111-1111-1111-111111111111");
  assert.notDeepEqual(a, b);
});

test("[TRUE TEST] getPlotWorldPosition and getPlotCameraTarget both resolve to LAND_CENTER + the same offset for a given profile id", () => {
  const profileId = "22222222-2222-2222-2222-222222222222";
  const offset = getPlotOffset(profileId);
  const worldPos = getPlotWorldPosition(profileId);
  const cameraTarget = getPlotCameraTarget(profileId);
  assert.equal(worldPos.x, LAND_CENTER.x + offset.dx);
  assert.equal(worldPos.y, LAND_CENTER.y + offset.dy);
  assert.equal(cameraTarget.x, worldPos.x);
  assert.equal(cameraTarget.y, worldPos.y);
});

// ---- Source-scan guards: no fabricated "real-looking" data in the Phase 1 UI ----
// Live presence, relics, inventory, and missions don't exist yet (confirmed during the
// pre-implementation audit -- no realtime provider, no kingdom_relics/inventory schema). These
// guard against a future edit accidentally papering over that gap with fake-but-plausible content
// instead of an honest empty state, which the task spec explicitly forbids.

test("[SOURCE SCAN] SeekerPanel shows an honest empty state, not fabricated seeker names", () => {
  const source = read("components/kingdom-scrolls/SeekerPanel.tsx");
  assert.match(source, /coming in a future update/i);
  assert.doesNotMatch(source, /Ava M\.|Marcus T\.|Lily R\./, "must not hard-code placeholder seeker names that could be mistaken for real users");
});

test("[SOURCE SCAN] InventoryTray shows an honest empty state, not fabricated relic/item data", () => {
  const source = read("components/kingdom-scrolls/InventoryTray.tsx");
  assert.match(source, /empty|coming in a future update/i);
});

test("[SOURCE SCAN] the Kingdom Scrolls route is registered as a bare (chrome-free) route in PageShell", () => {
  const source = read("components/layout/PageShell.tsx");
  assert.match(source, /BARE_ROUTE_PREFIXES[\s\S]*?"\/kingdom-scrolls"/);
});

test("[SOURCE SCAN] the daily lesson panel links to the real existing lesson route, not a new disconnected one", () => {
  const source = read("components/kingdom-scrolls/InfoPanel.tsx");
  // dailyLesson.href is built in app/kingdom-scrolls/page.tsx as `/lessons/${slug}` -- this just
  // confirms InfoPanel renders whatever href it's given via a real <Link>, not a hard-coded path.
  assert.match(source, /<Link href=\{dailyLesson\.href\}/);
});

test("[SOURCE SCAN] app/kingdom-scrolls/page.tsx builds the daily lesson link from the real campaign-lesson slug, not a hard-coded lesson", () => {
  const source = read("app/kingdom-scrolls/page.tsx");
  assert.match(source, /getCurrentWeekCampaignLesson/);
  assert.match(source, /`\/lessons\/\$\{currentLesson\.slug\}`/);
});
