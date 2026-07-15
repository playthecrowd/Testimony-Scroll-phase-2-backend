import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMediaDiff, EditableMediaItem } from "../lib/mediaDiff";

function item(overrides: Partial<EditableMediaItem>): EditableMediaItem {
  return { id: null, mediaType: "notes", url: "", content: "", title: "", sortOrder: 0, ...overrides };
}

// Regression #6/#13: saving media edits never creates a duplicate lesson_media row for an item
// that already has an id, add/edit/reorder/remove all map to the correct insert/update/delete
// bucket, and a removed item's id is the only one ever slated for deletion.

test("a brand-new item (no id) is queued for insert, not update", () => {
  const diff = computeMediaDiff([], [item({ id: null, url: "https://example.com/a" })]);
  assert.equal(diff.toInsert.length, 1);
  assert.equal(diff.toUpdate.length, 0);
  assert.equal(diff.toDeleteIds.length, 0);
});

test("an existing item (has id) is queued for update, never re-inserted as a duplicate", () => {
  const diff = computeMediaDiff([{ id: "m1" }], [item({ id: "m1", url: "https://example.com/edited" })]);
  assert.equal(diff.toInsert.length, 0);
  assert.equal(diff.toUpdate.length, 1);
  assert.equal(diff.toUpdate[0].id, "m1");
  assert.equal(diff.toDeleteIds.length, 0);
});

test("an existing item missing from the submitted list is queued for deletion", () => {
  const diff = computeMediaDiff([{ id: "m1" }, { id: "m2" }], [item({ id: "m1" })]);
  assert.deepEqual(diff.toDeleteIds, ["m2"]);
});

test("reordering (sortOrder change only) does not delete or duplicate anything", () => {
  const existing = [{ id: "m1" }, { id: "m2" }];
  const submitted = [item({ id: "m2", sortOrder: 0 }), item({ id: "m1", sortOrder: 1 })];
  const diff = computeMediaDiff(existing, submitted);
  assert.equal(diff.toInsert.length, 0);
  assert.equal(diff.toDeleteIds.length, 0);
  assert.equal(diff.toUpdate.length, 2);
});

test("a mix of add + edit + remove computes all three buckets correctly", () => {
  const existing = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
  const submitted = [
    item({ id: "m1", title: "edited" }), // kept + edited
    item({ id: null, url: "https://example.com/new" }), // newly added
    // m2 removed by omission, m3 removed by omission
  ];
  const diff = computeMediaDiff(existing, submitted);
  assert.equal(diff.toUpdate.length, 1);
  assert.equal(diff.toInsert.length, 1);
  assert.deepEqual(diff.toDeleteIds.sort(), ["m2", "m3"]);
});
