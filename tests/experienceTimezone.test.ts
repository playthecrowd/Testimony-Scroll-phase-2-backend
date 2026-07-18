import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOccurrenceDateTime, formatOccurrenceTimeRange, formatTimezoneLabel, isFutureOccurrence, getCommonTimezoneOptions } from "../lib/experienceTimezone";

// Phase 10.3: pure-function unit tests for the Experience Platform's timezone display helper --
// this codebase's first timezone-aware display logic (spec SS9/SS27). No Supabase needed.

test("formatOccurrenceDateTime renders a real instant in the requested IANA zone", () => {
  const formatted = formatOccurrenceDateTime("2026-01-15T18:00:00.000Z", "America/Chicago");
  // 18:00 UTC in January is 12:00 PM Central (CST, UTC-6) -- assert on the parts that must be
  // stable regardless of the exact Intl locale formatting nuances (date + hour), not the whole string.
  assert.match(formatted, /Jan/);
  assert.match(formatted, /15/);
  assert.match(formatted, /12:00/);
});

test("formatOccurrenceDateTime accounts for daylight saving automatically via the IANA name", () => {
  // 18:00 UTC in July is 1:00 PM Central (CDT, UTC-5) -- a fixed-offset column could never get
  // this right without separately tracking DST; the IANA name resolves it automatically.
  const formatted = formatOccurrenceDateTime("2026-07-15T18:00:00.000Z", "America/Chicago");
  assert.match(formatted, /1:00/);
});

test("formatOccurrenceDateTime falls back gracefully for an unrecognized timezone rather than throwing", () => {
  const formatted = formatOccurrenceDateTime("2026-01-15T18:00:00.000Z", "Not/ARealZone");
  assert.match(formatted, /UTC/);
});

test("formatOccurrenceTimeRange renders just the start time when there's no end time", () => {
  const formatted = formatOccurrenceTimeRange("2026-01-15T18:00:00.000Z", null, "America/Chicago");
  assert.doesNotMatch(formatted, /–/);
});

test("formatOccurrenceTimeRange renders a start–end range when an end time is present", () => {
  const formatted = formatOccurrenceTimeRange("2026-01-15T18:00:00.000Z", "2026-01-15T20:00:00.000Z", "America/Chicago");
  assert.match(formatted, /–/);
});

test("formatTimezoneLabel resolves a short zone abbreviation for a known IANA name", () => {
  const label = formatTimezoneLabel("2026-01-15T18:00:00.000Z", "America/Chicago");
  assert.ok(label.length > 0);
});

test("formatTimezoneLabel falls back to the raw IANA name for an unrecognized zone", () => {
  const label = formatTimezoneLabel("2026-01-15T18:00:00.000Z", "Not/ARealZone");
  assert.equal(label, "Not/ARealZone");
});

test("isFutureOccurrence returns true for a timestamp far in the future", () => {
  assert.equal(isFutureOccurrence("2999-01-01T00:00:00.000Z"), true);
});

test("isFutureOccurrence returns false for a timestamp in the past", () => {
  assert.equal(isFutureOccurrence("2000-01-01T00:00:00.000Z"), false);
});

test("getCommonTimezoneOptions returns a non-empty, deduplicated-looking list including UTC", () => {
  const options = getCommonTimezoneOptions();
  assert.ok(options.length > 5);
  assert.ok(options.includes("UTC"));
  assert.equal(new Set(options).size, options.length);
});
