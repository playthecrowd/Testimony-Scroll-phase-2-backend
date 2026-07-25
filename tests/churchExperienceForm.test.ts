import { test } from "node:test";
import assert from "node:assert/strict";
import { validateExperienceInput, validateOccurrenceInput, findDuplicateLessonSelections } from "../lib/churchExperienceForm";

// Phase 10.3: pure-function unit tests for the shared Experience/occurrence form validation --
// no Supabase needed, matching this repo's existing plain-function unit-test style
// (tests/youtubeEmbed.test.ts precedent).

test("validateExperienceInput: a fully valid input has no errors", () => {
  const errors = validateExperienceInput({
    churchId: "church-1",
    title: "Community Food Drive",
    type: "service_project",
    customTypeLabel: null,
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
  });
  assert.deepEqual(errors, {});
});

test("validateExperienceInput: requires churchId and title", () => {
  const errors = validateExperienceInput({
    churchId: "",
    title: "",
    type: "volunteer",
    customTypeLabel: null,
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
  });
  assert.ok(errors.churchId);
  assert.ok(errors.title);
});

test("validateExperienceInput: type='custom' requires a customTypeLabel", () => {
  const errors = validateExperienceInput({
    churchId: "church-1",
    title: "Something",
    type: "custom",
    customTypeLabel: null,
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
  });
  assert.ok(errors.customTypeLabel);
});

test("validateExperienceInput: type='custom' with a label present has no error", () => {
  const errors = validateExperienceInput({
    churchId: "church-1",
    title: "Something",
    type: "custom",
    customTypeLabel: "Youth Lock-In",
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
  });
  assert.equal(errors.customTypeLabel, undefined);
});

test("validateExperienceInput: rejects an invalid enum value", () => {
  const errors = validateExperienceInput({
    churchId: "church-1",
    title: "Something",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately invalid input, testing runtime validation of a value TypeScript itself would normally reject
    type: "not-a-real-type" as any,
    customTypeLabel: null,
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
  });
  assert.ok(errors.type);
});

test("validateExperienceInput: defaultCapacity must be a positive integer when present", () => {
  const errors = validateExperienceInput({
    churchId: "church-1",
    title: "Something",
    type: "volunteer",
    customTypeLabel: null,
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
    defaultCapacity: 0,
  });
  assert.ok(errors.defaultCapacity);
});

test("validateExperienceInput: defaultCapacity may be null (unlimited)", () => {
  const errors = validateExperienceInput({
    churchId: "church-1",
    title: "Something",
    type: "volunteer",
    customTypeLabel: null,
    format: "in_person",
    visibility: "church_only",
    completionMethod: "host_marked",
    defaultCapacity: null,
  });
  assert.equal(errors.defaultCapacity, undefined);
});

const baseOccurrence = {
  experienceId: "exp-1",
  churchId: "church-1",
  experienceFormat: "in_person" as const,
  experienceLocationName: "Fellowship Hall",
  experienceOnlineUrl: null,
  startsAt: "2026-08-01T18:00:00.000Z",
  endsAt: "2026-08-01T20:00:00.000Z",
  timezone: "America/Chicago",
  locationName: null,
  onlineUrl: null,
  capacity: 20,
};

test("validateOccurrenceInput: a fully valid input has no errors", () => {
  const errors = validateOccurrenceInput(baseOccurrence);
  assert.deepEqual(errors, {});
});

test("validateOccurrenceInput: end time must be after start time", () => {
  const errors = validateOccurrenceInput({
    ...baseOccurrence,
    startsAt: "2026-08-01T20:00:00.000Z",
    endsAt: "2026-08-01T18:00:00.000Z",
  });
  assert.ok(errors.endsAt);
});

test("validateOccurrenceInput: end time equal to start time is also rejected", () => {
  const errors = validateOccurrenceInput({
    ...baseOccurrence,
    startsAt: "2026-08-01T18:00:00.000Z",
    endsAt: "2026-08-01T18:00:00.000Z",
  });
  assert.ok(errors.endsAt);
});

test("validateOccurrenceInput: requires startsAt and timezone", () => {
  const errors = validateOccurrenceInput({ ...baseOccurrence, startsAt: "", timezone: "" });
  assert.ok(errors.startsAt);
  assert.ok(errors.timezone);
});

test("validateOccurrenceInput: capacity must be a positive integer when present", () => {
  const errors = validateOccurrenceInput({ ...baseOccurrence, capacity: -1 });
  assert.ok(errors.capacity);
});

test("validateOccurrenceInput: capacity may be null (unlimited)", () => {
  const errors = validateOccurrenceInput({ ...baseOccurrence, capacity: null });
  assert.equal(errors.capacity, undefined);
});

test("validateOccurrenceInput: in-person/hybrid Experience requires a location (occurrence override or Experience default)", () => {
  const errors = validateOccurrenceInput({ ...baseOccurrence, experienceLocationName: null, locationName: null });
  assert.ok(errors.locationName);
});

test("validateOccurrenceInput: occurrence-level location override satisfies the in-person requirement even with no Experience default", () => {
  const errors = validateOccurrenceInput({ ...baseOccurrence, experienceLocationName: null, locationName: "Room 204" });
  assert.equal(errors.locationName, undefined);
});

test("validateOccurrenceInput: online/hybrid Experience requires a usable meeting link", () => {
  const errors = validateOccurrenceInput({
    ...baseOccurrence,
    experienceFormat: "online",
    experienceLocationName: null,
    experienceOnlineUrl: null,
    onlineUrl: null,
  });
  assert.ok(errors.onlineUrl);
});

test("validateOccurrenceInput: online Experience rejects a non-http(s) meeting link", () => {
  const errors = validateOccurrenceInput({
    ...baseOccurrence,
    experienceFormat: "online",
    experienceOnlineUrl: null,
    onlineUrl: "javascript:alert(1)",
  });
  assert.ok(errors.onlineUrl);
});

test("validateOccurrenceInput: online Experience accepts a valid https meeting link", () => {
  const errors = validateOccurrenceInput({
    ...baseOccurrence,
    experienceFormat: "online",
    experienceLocationName: null,
    experienceOnlineUrl: null,
    onlineUrl: "https://zoom.us/j/123456",
  });
  assert.equal(errors.onlineUrl, undefined);
});

test("validateOccurrenceInput: self_guided Experience requires neither location nor URL", () => {
  const errors = validateOccurrenceInput({
    ...baseOccurrence,
    experienceFormat: "self_guided",
    experienceLocationName: null,
    experienceOnlineUrl: null,
    locationName: null,
    onlineUrl: null,
  });
  assert.equal(errors.locationName, undefined);
  assert.equal(errors.onlineUrl, undefined);
});

test("findDuplicateLessonSelections: returns lesson ids that appear more than once", () => {
  const duplicates = findDuplicateLessonSelections(["a", "b", "a", "c", "b", "b"]);
  assert.deepEqual(new Set(duplicates), new Set(["a", "b"]));
});

test("findDuplicateLessonSelections: returns an empty array when there are no duplicates", () => {
  assert.deepEqual(findDuplicateLessonSelections(["a", "b", "c"]), []);
});
