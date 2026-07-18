import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLevelFromXp, xpToNextLevel } from "../lib/progressionLevels";

// Phase 11.3: pure-function unit tests, matching this repo's existing plain-function unit-test
// style (tests/experienceCredits.test.ts precedent).

const thresholds = [
  { level: 1, minXp: 0 },
  { level: 2, minXp: 50 },
  { level: 3, minXp: 120 },
  { level: 4, minXp: 220 },
];

test("calculateLevelFromXp: 0 XP is level 1", () => {
  assert.equal(calculateLevelFromXp(0, thresholds), 1);
});

test("calculateLevelFromXp: XP exactly at a threshold reaches that level", () => {
  assert.equal(calculateLevelFromXp(50, thresholds), 2);
});

test("calculateLevelFromXp: XP one below a threshold stays at the previous level", () => {
  assert.equal(calculateLevelFromXp(49, thresholds), 1);
});

test("calculateLevelFromXp: XP above the highest defined threshold caps at the highest level", () => {
  assert.equal(calculateLevelFromXp(10000, thresholds), 4);
});

test("calculateLevelFromXp: an empty threshold table defaults to level 1", () => {
  assert.equal(calculateLevelFromXp(500, []), 1);
});

test("xpToNextLevel: reports exactly how much XP is needed to reach the next level", () => {
  assert.equal(xpToNextLevel(30, thresholds), 20);
});

test("xpToNextLevel: null once already at the highest defined level", () => {
  assert.equal(xpToNextLevel(220, thresholds), null);
  assert.equal(xpToNextLevel(99999, thresholds), null);
});
