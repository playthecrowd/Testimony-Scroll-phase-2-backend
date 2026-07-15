import { test } from "node:test";
import assert from "node:assert/strict";
import { hasChurchEditAccess } from "../lib/lessonAuth";

// Regression #1/#2/#3: only a host/admin church_memberships role may edit a lesson -- this is the
// same predicate the edit page, the update server action, and the lesson-detail Edit Experience
// button all gate on.

test("host role can edit", () => {
  assert.equal(hasChurchEditAccess("host"), true);
});

test("admin role can edit", () => {
  assert.equal(hasChurchEditAccess("admin"), true);
});

test("member role cannot edit (Kingdom Member denied)", () => {
  assert.equal(hasChurchEditAccess("member"), false);
});

test("no membership row cannot edit (host of another church denied)", () => {
  assert.equal(hasChurchEditAccess(null), false);
  assert.equal(hasChurchEditAccess(undefined), false);
});
