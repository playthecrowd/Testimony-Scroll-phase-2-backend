import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "../lib/utils";

// Repair Batch 5, D9 (Trello RQYoZPId): a date-only string ("2026-07-20") was parsed by
// `new Date(dateStr)` as UTC midnight, then formatted in the local timezone -- one day early in
// any timezone behind UTC, plus a real React hydration error #418 from the server/client text
// mismatch. These are [TRUE TEST]s: real calls to the actual exported function, timezone-independent
// by construction (compared directly against an equivalent local-explicit Date, not a fixed string).

test("[TRUE TEST] formatDate on a date-only string matches an explicit local-calendar-date construction, in any timezone", () => {
  const expected = new Date(2026, 6, 20).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  assert.equal(formatDate("2026-07-20"), expected);
});

test("[TRUE TEST] formatDate on a date-only string never shifts to the previous day (the exact original bug)", () => {
  // If the old UTC-midnight parsing bug were present, this would format as "Jan 31" in any
  // timezone behind UTC instead of "Feb 1".
  const result = formatDate("2026-02-01");
  assert.doesNotMatch(result, /Jan 31/);
  assert.match(result, /Feb 1/);
});

test("[TRUE TEST] formatDate still handles a full ISO timestamp (e.g. a badge's awardedAt) via normal Date parsing, unaffected by the date-only fix", () => {
  const iso = "2026-07-20T15:30:00.000Z";
  assert.equal(formatDate(iso), new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
});

test("[TRUE TEST] formatDate does not throw on invalid input", () => {
  assert.doesNotThrow(() => formatDate("not-a-date"));
  assert.equal(typeof formatDate("not-a-date"), "string");
});
