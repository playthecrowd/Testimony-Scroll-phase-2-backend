import { PublishedLesson } from "@/types";

const CAMPAIGN_YEAR_START_MONTH = 9; // September

// campaign_month_number always stores the real calendar month (1-12), so a plain ascending sort
// on it puts January before September even though the Year-Round Campaign's own year starts in
// September. This maps a calendar month to its position within that September-to-August year
// (September = 1st, ..., August = 12th) instead.
function academicMonthRank(calendarMonthNumber: number): number {
  return ((calendarMonthNumber - CAMPAIGN_YEAR_START_MONTH + 12) % 12) + 1;
}

// Homepage "Featured Campaign Lessons" row: every published, featured Year-Round Campaign Lesson,
// in September -> August, Week 1 -> 4 order. Deliberately re-derived from campaignMonthNumber/
// campaignWeekNumber rather than trusted from each row's own sortOrder column -- sortOrder happens
// to already match this order for the current import, but nothing enforces that it always will for
// a future one, while month/week directly encode what was actually asked for.
export function selectFeaturedCampaignLessonsForHomepage(lessons: PublishedLesson[]): PublishedLesson[] {
  return lessons
    .filter((l) => l.featured && l.campaignName === "Year-Round Campaign Lessons")
    .slice()
    .sort((a, b) => {
      const rankA = academicMonthRank(a.campaignMonthNumber ?? 0);
      const rankB = academicMonthRank(b.campaignMonthNumber ?? 0);
      if (rankA !== rankB) return rankA - rankB;
      return (a.campaignWeekNumber ?? 0) - (b.campaignWeekNumber ?? 0);
    });
}
