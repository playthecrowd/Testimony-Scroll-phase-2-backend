import { test } from "node:test";
import assert from "node:assert/strict";
import { getApplicableChecklistItems, isKnownChecklistItemKey, ChecklistLessonInput } from "../lib/journeyChecklist";

// Two brand-new synthetic lesson fixtures, deliberately not among the four real lessons already
// in Supabase, each with a different media combination -- proving the checklist architecture is
// driven entirely by content, not by any lesson-specific code, route, or migration. Neither
// fixture's id/title has ever appeared anywhere else in this codebase.

const lessonWithFullMedia: ChecklistLessonInput = {
  aboutText: "An overview of a brand-new lesson.",
  primaryScripture: "John 3:16",
  supportingScriptures: ["Romans 5:8", "1 John 4:9"],
  media: [
    { mediaType: "notes" },
    { mediaType: "video" },
    { mediaType: "audio" },
    { mediaType: "slides" },
    { mediaType: "document" },
  ],
};

const lessonWithMinimalMedia: ChecklistLessonInput = {
  aboutText: "",
  primaryScripture: "Psalm 23:1",
  supportingScriptures: [],
  media: [{ mediaType: "notes" }],
};

test("a future lesson with every media type gets every corresponding checklist item", () => {
  const items = getApplicableChecklistItems(lessonWithFullMedia);
  const keys = items.map((i) => i.key);
  assert.deepEqual(
    keys.sort(),
    ["audio", "document", "notes", "overview", "primary_scripture", "questions", "slides", "supporting_scriptures", "video"].sort()
  );
});

test("a future lesson missing optional content never requires items for content it doesn't have", () => {
  const items = getApplicableChecklistItems(lessonWithMinimalMedia);
  const keys = items.map((i) => i.key);
  // No overview (empty aboutText), no supporting scriptures (empty array), and none of
  // video/audio/slides/document -- only what's actually present, plus the always-present items.
  assert.deepEqual(keys.sort(), ["notes", "primary_scripture", "questions"].sort());
  assert.ok(!keys.includes("video"), "must not require Watch the video when there is no video");
  assert.ok(!keys.includes("slides"), "must not require Review the slides when there are no slides");
});

test("questions is always included regardless of media combination", () => {
  assert.ok(getApplicableChecklistItems(lessonWithFullMedia).some((i) => i.key === "questions"));
  assert.ok(getApplicableChecklistItems(lessonWithMinimalMedia).some((i) => i.key === "questions"));
});

test("an unrelated future third lesson with yet another combination still works with no code change", () => {
  const thirdLesson: ChecklistLessonInput = {
    aboutText: "Another new lesson, different again.",
    primaryScripture: "",
    supportingScriptures: ["Isaiah 41:10"],
    media: [{ mediaType: "video" }, { mediaType: "video" }, { mediaType: "transcript" }],
  };
  const keys = getApplicableChecklistItems(thirdLesson).map((i) => i.key);
  assert.deepEqual(keys.sort(), ["overview", "questions", "supporting_scriptures", "video"].sort());
  // Two video rows collapse to a single "video" checklist item -- the item identity is the
  // content category, never a specific lesson_media row.
  assert.equal(keys.filter((k) => k === "video").length, 1);
});

test("stable keys: editing a lesson's content (e.g. adding slides) only adds the new item, never renames existing ones", () => {
  const before = getApplicableChecklistItems(lessonWithMinimalMedia).map((i) => i.key);
  const after = getApplicableChecklistItems({
    ...lessonWithMinimalMedia,
    media: [...lessonWithMinimalMedia.media, { mediaType: "slides" }],
  }).map((i) => i.key);

  // Every key that existed before still exists after (nothing was renamed/removed by the edit).
  for (const key of before) {
    assert.ok(after.includes(key), `"${key}" should still be present after adding unrelated content`);
  }
  // Exactly one new key was added.
  assert.deepEqual(after.filter((k) => !before.includes(k)), ["slides"]);
});

test("every generated key is a known, fixed-vocabulary key -- never derived from a title or row id", () => {
  const items = getApplicableChecklistItems(lessonWithFullMedia);
  for (const item of items) {
    assert.ok(isKnownChecklistItemKey(item.key), `"${item.key}" must be in the fixed vocabulary`);
  }
});
