import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNextStatus, isValidActionForStatus } from "../lib/lessonStatus";

// Regression #7/#8/#9/#10: draft stays draft on Save Draft, published stays published on
// Save Changes, Publish moves draft -> published, Unpublish moves published -> draft, and the
// two actions never available for the "wrong" status are rejected outright.

test("save-draft keeps a draft lesson draft", () => {
  assert.equal(resolveNextStatus("draft", "save-draft"), "draft");
});

test("publish moves a draft lesson to published", () => {
  assert.equal(resolveNextStatus("draft", "publish"), "published");
});

test("save-changes keeps a published lesson published", () => {
  assert.equal(resolveNextStatus("published", "save-changes"), "published");
});

test("unpublish moves a published lesson to draft", () => {
  assert.equal(resolveNextStatus("published", "unpublish"), "draft");
});

test("publish is not valid for an already-published lesson", () => {
  assert.equal(isValidActionForStatus("published", "publish"), false);
});

test("save-draft is not valid for a published lesson", () => {
  assert.equal(isValidActionForStatus("published", "save-draft"), false);
});

test("unpublish is not valid for a draft lesson", () => {
  assert.equal(isValidActionForStatus("draft", "unpublish"), false);
});

test("resolveNextStatus throws for a status/action combination that isn't allowed", () => {
  assert.throws(() => resolveNextStatus("draft", "unpublish"));
});
