import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidMediaUrl, validateRequiredLessonFields } from "../lib/lessonForm";

// Regression: trusted-provider validation rejects unsafe protocols (javascript:, data:, file:)
// and only ever accepts http/https -- shared by both the create and edit lesson forms.

test("http and https URLs are accepted", () => {
  assert.equal(isValidMediaUrl("https://example.com/notes.pdf"), true);
  assert.equal(isValidMediaUrl("http://example.com"), true);
});

test("an empty value is accepted (media fields are individually optional)", () => {
  assert.equal(isValidMediaUrl(""), true);
  assert.equal(isValidMediaUrl("   "), true);
});

test("javascript: URLs are rejected", () => {
  assert.equal(isValidMediaUrl("javascript:alert(1)"), false);
});

test("data: URLs are rejected", () => {
  assert.equal(isValidMediaUrl("data:text/html,<script>alert(1)</script>"), false);
});

test("file: URLs are rejected", () => {
  assert.equal(isValidMediaUrl("file:///etc/passwd"), false);
});

test("malformed URLs are rejected", () => {
  assert.equal(isValidMediaUrl("not a url"), false);
});

const validFields = {
  title: "Walking in Faith",
  topic: "Faith",
  shortDescription: "A short summary",
  speakerName: "Pastor Dan",
  date: "2026-01-01",
  ministryCategory: "Sunday Service",
  primaryScripture: "Matthew 6:33",
};

test("a fully-populated required-field set passes validation", () => {
  assert.equal(validateRequiredLessonFields(validFields), null);
});

test("a missing title is rejected with a specific message", () => {
  assert.match(validateRequiredLessonFields({ ...validFields, title: "" }) ?? "", /title/i);
});

test("a missing speaker name is rejected", () => {
  assert.match(validateRequiredLessonFields({ ...validFields, speakerName: "  " }) ?? "", /speaker/i);
});
