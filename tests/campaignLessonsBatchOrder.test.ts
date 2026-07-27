import { test } from "node:test";
import assert from "node:assert/strict";
import { createCampaignLessonsBatch, CampaignLessonInput } from "../services/supabase/lessons";

// Regression for a production incident: createCampaignLessonsBatch previously trusted that
// `insert(rows).select(...)` returns rows in the same order as the submitted VALUES list. A
// multi-row INSERT's RETURNING clause has no ORDER BY, so Postgres/PostgREST does not guarantee
// that -- a real 48-row CSV import came back in exactly reversed order, and importActions.ts (which
// zips this function's return value against the original CSV rows by index) silently attached every
// lesson to a different lesson's questions. This fake client always returns insert results in
// reverse order, on purpose, to prove the fix (matching by slug) survives that.
function makeInput(title: string, sortOrder: number): CampaignLessonInput {
  return {
    campaignName: "Test Campaign",
    campaignSprintSeason: "",
    campaignMonth: "September",
    campaignMonthNumber: 9,
    campaignWeekNumber: 1,
    campaignMonthlyTheme: "",
    campaignMonthlyVerse: "",
    title,
    shortDescription: "",
    aboutText: "",
    campaignWeeklyVerse: "",
    campaignSpeakerName: "",
    campaignSpeakerBio: "",
    campaignSpeakerImageUrl: "",
    featuredImageUrl: "",
    backgroundImageUrl: "",
    isFeatured: false,
    isHighlighted: false,
    sortOrder,
    displayStartDate: "",
    linkedExperienceId: null,
  };
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Minimal fake shaped exactly like the two calls createCampaignLessonsBatch actually makes:
// (1) `.from("lessons").select("id").eq("slug", slug).maybeSingle()` for each row's uniqueness
//     check (generateUniqueCampaignSlug) -- always reports "not taken" so every input slug is used
//     as-is.
// (2) `.from("lessons").insert(rows).select(LESSON_SELECT)` for the actual batch write -- returns
//     the inserted rows in REVERSED order on purpose, simulating the real, observed non-guarantee.
function makeFakeSupabase() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from(_table: string) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        select(_cols: string) {
          return {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            eq(_col: string, _val: string) {
              return { maybeSingle: async () => ({ data: null }) };
            },
          };
        },
        insert(rows: Record<string, unknown>[]) {
          return {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            select(_cols: string) {
              const reversed = [...rows].reverse().map((r, i) => ({
                id: `id-${i}`,
                slug: r.slug,
                title: r.title,
                short_description: null,
                about_text: null,
                topic: null,
                subject: null,
                ministry_category: null,
                date: null,
                duration_label: null,
                lesson_type: null,
                primary_scripture: null,
                supporting_scriptures: null,
                tags: null,
                featured_image_url: null,
                background_image_url: null,
                featured_image_alt: null,
                quest_url: null,
                quest_level: null,
                xp_reward: null,
                status: "draft",
                contributors_count: 0,
                featured: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_campaign_lesson: true,
                campaign_name: r.campaign_name,
                campaign_sprint_season: null,
                campaign_month: r.campaign_month,
                campaign_month_number: r.campaign_month_number,
                campaign_week_number: r.campaign_week_number,
                campaign_monthly_theme: null,
                campaign_monthly_verse: null,
                campaign_weekly_verse: null,
                campaign_speaker_name: null,
                campaign_speaker_bio: null,
                campaign_speaker_image_url: null,
                is_highlighted: false,
                sort_order: r.sort_order,
                display_start_date: null,
                linked_experience_id: null,
                church_id: null,
                speaker_id: null,
                church: null,
                speaker: null,
                media: [],
                hosts: [],
                ministries: [],
                questions: [],
                experiences: [],
              }));
              return Promise.resolve({ data: reversed, error: null });
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("[TRUE TEST] createCampaignLessonsBatch returns lessons in the same order as the submitted inputs, even when the database returns insert results in reversed order", async () => {
  const inputs = [makeInput("Call to Follow", 1), makeInput("Prepared Workers", 2), makeInput("Hear Master", 3), makeInput("Active Laborers", 4)];
  const fake = makeFakeSupabase();
  const result = await createCampaignLessonsBatch(fake, inputs);

  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map((r) => r.title),
    ["Call to Follow", "Prepared Workers", "Hear Master", "Active Laborers"],
    "result order must match input order, not the database's (reversed) return order"
  );
  assert.deepEqual(
    result.map((r) => r.sortOrder),
    [1, 2, 3, 4]
  );
});

test("[TRUE TEST] createCampaignLessonsBatch matches each returned lesson to its own slug, not a positional guess", async () => {
  const inputs = [makeInput("Alpha Lesson", 1), makeInput("Beta Lesson", 2)];
  const fake = makeFakeSupabase();
  const result = await createCampaignLessonsBatch(fake, inputs);

  assert.equal(result[0].slug, slugify("Alpha Lesson"));
  assert.equal(result[1].slug, slugify("Beta Lesson"));
});

test("[TRUE TEST] createCampaignLessonsBatch returns an empty array for an empty input without calling the database", async () => {
  const fake = makeFakeSupabase();
  const result = await createCampaignLessonsBatch(fake, []);
  assert.deepEqual(result, []);
});
