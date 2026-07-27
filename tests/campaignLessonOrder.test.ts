import { test } from "node:test";
import assert from "node:assert/strict";
import { selectFeaturedCampaignLessonsForHomepage } from "../lib/campaignLessonOrder";
import { PublishedLesson } from "../types";

function makeLesson(overrides: Partial<PublishedLesson> & { id: string }): PublishedLesson {
  return {
    slug: overrides.id,
    title: overrides.id,
    shortDescription: null,
    aboutText: null,
    topic: null,
    subject: null,
    ministryCategory: null,
    date: null,
    durationLabel: null,
    lessonType: null,
    primaryScripture: null,
    supportingScriptures: [],
    tags: [],
    featuredImageUrl: null,
    featuredImageAlt: null,
    backgroundImageUrl: null,
    questUrl: null,
    questLevel: null,
    xpReward: null,
    status: "published",
    contributorsCount: 0,
    featured: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    church: null,
    speaker: null,
    media: [],
    hosts: [],
    ministries: [],
    questions: [],
    experiences: [],
    isCampaignLesson: true,
    campaignName: "Year-Round Campaign Lessons",
    campaignSprintSeason: null,
    campaignMonth: null,
    campaignMonthNumber: null,
    campaignWeekNumber: null,
    campaignMonthlyTheme: null,
    campaignMonthlyVerse: null,
    campaignWeeklyVerse: null,
    campaignSpeakerName: null,
    campaignSpeakerBio: null,
    campaignSpeakerImageUrl: null,
    isHighlighted: false,
    sortOrder: 0,
    displayStartDate: null,
    linkedExperienceId: null,
    ...overrides,
  };
}

test("[TRUE TEST] selectFeaturedCampaignLessonsForHomepage excludes lessons that are not featured", () => {
  const lessons = [
    makeLesson({ id: "a", featured: true, campaignMonthNumber: 9, campaignWeekNumber: 1 }),
    makeLesson({ id: "b", featured: false, campaignMonthNumber: 9, campaignWeekNumber: 2 }),
  ];
  const result = selectFeaturedCampaignLessonsForHomepage(lessons);
  assert.deepEqual(result.map((l) => l.id), ["a"]);
});

test("[TRUE TEST] selectFeaturedCampaignLessonsForHomepage excludes lessons from a different campaign (e.g. QA campaigns)", () => {
  const lessons = [
    makeLesson({ id: "real", featured: true, campaignName: "Year-Round Campaign Lessons", campaignMonthNumber: 9, campaignWeekNumber: 1 }),
    makeLesson({ id: "qa", featured: true, campaignName: "QA Verification Campaign", campaignMonthNumber: 9, campaignWeekNumber: 1 }),
  ];
  const result = selectFeaturedCampaignLessonsForHomepage(lessons);
  assert.deepEqual(result.map((l) => l.id), ["real"]);
});

test("[TRUE TEST] selectFeaturedCampaignLessonsForHomepage orders September through August (the campaign's own year), not calendar Jan-Dec order", () => {
  const lessons = [
    makeLesson({ id: "jan", campaignMonthNumber: 1, campaignWeekNumber: 1 }),
    makeLesson({ id: "sep", campaignMonthNumber: 9, campaignWeekNumber: 1 }),
    makeLesson({ id: "dec", campaignMonthNumber: 12, campaignWeekNumber: 1 }),
    makeLesson({ id: "aug", campaignMonthNumber: 8, campaignWeekNumber: 1 }),
  ];
  const result = selectFeaturedCampaignLessonsForHomepage(lessons);
  assert.deepEqual(
    result.map((l) => l.id),
    ["sep", "dec", "jan", "aug"]
  );
});

test("[TRUE TEST] selectFeaturedCampaignLessonsForHomepage orders weeks 1-4 within the same month", () => {
  const lessons = [
    makeLesson({ id: "w3", campaignMonthNumber: 9, campaignWeekNumber: 3 }),
    makeLesson({ id: "w1", campaignMonthNumber: 9, campaignWeekNumber: 1 }),
    makeLesson({ id: "w4", campaignMonthNumber: 9, campaignWeekNumber: 4 }),
    makeLesson({ id: "w2", campaignMonthNumber: 9, campaignWeekNumber: 2 }),
  ];
  const result = selectFeaturedCampaignLessonsForHomepage(lessons);
  assert.deepEqual(
    result.map((l) => l.id),
    ["w1", "w2", "w3", "w4"]
  );
});

test("[TRUE TEST] selectFeaturedCampaignLessonsForHomepage produces the exact full 48-lesson September->August sequence", () => {
  const monthOrder = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
  const lessons = monthOrder.flatMap((month) =>
    [1, 2, 3, 4].map((week) => makeLesson({ id: `m${month}-w${week}`, campaignMonthNumber: month, campaignWeekNumber: week }))
  );
  // Shuffle the input so the test can't accidentally pass just because the input already happened
  // to be in order.
  const shuffled = [...lessons].reverse();
  const result = selectFeaturedCampaignLessonsForHomepage(shuffled);

  const expectedIds = monthOrder.flatMap((month) => [1, 2, 3, 4].map((week) => `m${month}-w${week}`));
  assert.deepEqual(
    result.map((l) => l.id),
    expectedIds
  );
  assert.equal(result.length, 48);
});
