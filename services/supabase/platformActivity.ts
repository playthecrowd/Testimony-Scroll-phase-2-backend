import type { SupabaseClient } from "@supabase/supabase-js";
import { ChurchExperience } from "@/types";
import { getMyChurches } from "./churches";
import { getPublishedExperiencesForMember } from "./churchExperiences";

export interface PlatformActivityCounts {
  activeExperiencesCount: number;
  publishedCampaignLessonsCount: number;
  membersJoinedCount: number;
  lessonsStartedCount: number;
  lessonsCompletedCount: number;
  testimoniesSharedCount: number;
  pendingRegistrationsCount: number;
}

const EMPTY_COUNTS: PlatformActivityCounts = {
  activeExperiencesCount: 0,
  publishedCampaignLessonsCount: 0,
  membersJoinedCount: 0,
  lessonsStartedCount: 0,
  lessonsCompletedCount: 0,
  testimoniesSharedCount: 0,
  pendingRegistrationsCount: 0,
};

// Backs the public homepage's "Kingdom Activity" panel -- real, non-fabricated numbers for every
// visitor, signed in or not. Calls get_platform_activity_counts() (supabase/migrations/
// 0038_campaign_lessons.sql), a SECURITY DEFINER function granted to anon+authenticated that
// returns aggregate integers only, never row-level/identifying data -- the tables it aggregates
// (church_experiences, profiles, lesson_journeys, testimonies, church_experience_registrations)
// all grant SELECT to `authenticated` only, so a direct query here would return nothing for a
// signed-out visitor. If the RPC itself fails (e.g. before this migration has been applied), the
// homepage must still render -- callers get a graceful all-zero result, never a thrown error.
interface PlatformActivityCountsRow {
  active_experiences_count: number;
  published_campaign_lessons_count: number;
  members_joined_count: number;
  lessons_started_count: number;
  lessons_completed_count: number;
  testimonies_shared_count: number;
  pending_registrations_count: number;
}

export async function getPlatformActivityCounts(supabase: SupabaseClient): Promise<PlatformActivityCounts> {
  const { data, error } = await supabase.rpc("get_platform_activity_counts").maybeSingle();
  if (error || !data) {
    if (error) console.error("[getPlatformActivityCounts] Failed to load platform activity counts:", error);
    return EMPTY_COUNTS;
  }
  const row = data as PlatformActivityCountsRow;
  return {
    activeExperiencesCount: Number(row.active_experiences_count ?? 0),
    publishedCampaignLessonsCount: Number(row.published_campaign_lessons_count ?? 0),
    membersJoinedCount: Number(row.members_joined_count ?? 0),
    lessonsStartedCount: Number(row.lessons_started_count ?? 0),
    lessonsCompletedCount: Number(row.lessons_completed_count ?? 0),
    testimoniesSharedCount: Number(row.testimonies_shared_count ?? 0),
    pendingRegistrationsCount: Number(row.pending_registrations_count ?? 0),
  };
}

// The homepage's "Featured Experience" card. Per the explicit product decision preserving the
// existing "no public/cross-church Experience discovery" rule (app/experiences/page.tsx): a
// signed-out visitor never sees a real experience's title/church/location here, only the caller's
// own church's next published Experience once signed in -- reuses the same already-permitted query
// /experiences itself uses, no new exposure. Returns null for a signed-out visitor, a member with
// no church, or a member whose church has no published Experiences yet -- all three render the
// same graceful empty state on the homepage.
export interface FeaturedExperienceForViewer {
  experience: ChurchExperience;
  churchName: string;
}

export async function getFeaturedExperienceForViewer(supabase: SupabaseClient): Promise<FeaturedExperienceForViewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const churches = await getMyChurches(supabase);
    if (churches.length === 0) return null;
    const experiences = await getPublishedExperiencesForMember(supabase, churches.map((c) => c.id));
    const experience = experiences[0];
    if (!experience) return null;
    const church = churches.find((c) => c.id === experience.churchId);
    return { experience, churchName: church?.name ?? "your church" };
  } catch (err) {
    console.error("[getFeaturedExperienceForViewer] Failed to load featured experience:", err);
    return null;
  }
}
