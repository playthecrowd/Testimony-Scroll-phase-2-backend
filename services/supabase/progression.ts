import type { SupabaseClient } from "@supabase/supabase-js";
import { BadgeDefinition, ProgressionLeaderboardEntry, MemberBadgeAward, MemberProgressionSummary } from "@/types";

// Phase 11.3 (docs/PHASE11_3_AUDIT.md) -- typed service layer over the Points/XP/Levels/Badges
// schema landed in migrations 0032/0033. No UI, page, or route consumes this yet. Every award
// (points, XP, level, badge) is written exclusively by the database triggers wired in 0033 -- this
// file only ever reads; there is no function here that could write a point, an XP amount, or a
// badge award, matching the "no client ever decides an award" design (spec SS11/SS26).

const PROGRESSION_SUMMARY_SELECT = "id, profile_id, points_total, xp_total, current_level, leaderboard_opt_out, created_at, updated_at";
const BADGE_DEFINITION_SELECT = `
  id, slug, name, description, image_url, category, requirement_type, related_event_type,
  threshold, is_active, is_hidden_until_earned, display_order, created_at, updated_at
`;
const BADGE_AWARD_SELECT = `
  id, member_id, badge_id, award_source, related_lesson_id, related_experience_id,
  related_testimony_id, awarded_at, awarded_by, revoked_at, revocation_reason
`;
const LEADERBOARD_ENTRY_SELECT = "profile_id, full_name, points_total, xp_total, current_level, rank";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMemberProgressionSummary(row: any): MemberProgressionSummary {
  return {
    id: row.id,
    profileId: row.profile_id,
    pointsTotal: row.points_total,
    xpTotal: row.xp_total,
    currentLevel: row.current_level,
    leaderboardOptOut: row.leaderboard_opt_out,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBadgeDefinition(row: any): BadgeDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    category: row.category,
    requirementType: row.requirement_type,
    relatedEventType: row.related_event_type,
    threshold: row.threshold,
    isActive: row.is_active,
    isHiddenUntilEarned: row.is_hidden_until_earned,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMemberBadgeAward(row: any): MemberBadgeAward {
  return {
    id: row.id,
    memberId: row.member_id,
    badgeId: row.badge_id,
    awardSource: row.award_source,
    relatedLessonId: row.related_lesson_id,
    relatedExperienceId: row.related_experience_id,
    relatedTestimonyId: row.related_testimony_id,
    awardedAt: row.awarded_at,
    awardedBy: row.awarded_by,
    revokedAt: row.revoked_at,
    revocationReason: row.revocation_reason,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProgressionLeaderboardEntry(row: any): ProgressionLeaderboardEntry {
  return {
    profileId: row.profile_id,
    fullName: row.full_name,
    pointsTotal: row.points_total,
    xpTotal: row.xp_total,
    currentLevel: row.current_level,
    rank: row.rank,
    ...(row.church_id ? { churchId: row.church_id } : {}),
  };
}

// null when the member has never triggered a real progression event yet -- there is no wallet-
// style lazy-create here, since a summary row with all zeros is created automatically the moment
// the member's first real event fires (private.award_progression_event, 0033); a caller should
// treat null as "0 points, 0 XP, level 1", not as an error.
export async function getMyProgressionSummary(supabase: SupabaseClient): Promise<MemberProgressionSummary | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("member_progression_summaries")
    .select(PROGRESSION_SUMMARY_SELECT)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMemberProgressionSummary(data) : null;
}

export async function getMemberProgressionSummary(supabase: SupabaseClient, profileId: string): Promise<MemberProgressionSummary | null> {
  const { data, error } = await supabase
    .from("member_progression_summaries")
    .select(PROGRESSION_SUMMARY_SELECT)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMemberProgressionSummary(data) : null;
}

export async function getAllBadgeDefinitions(supabase: SupabaseClient): Promise<BadgeDefinition[]> {
  const { data, error } = await supabase
    .from("badge_definitions")
    .select(BADGE_DEFINITION_SELECT)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapBadgeDefinition);
}

export async function getMyBadgeAwards(supabase: SupabaseClient): Promise<MemberBadgeAward[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("member_badge_awards")
    .select(BADGE_AWARD_SELECT)
    .eq("member_id", user.id)
    .order("awarded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMemberBadgeAward);
}

export async function getGlobalLeaderboard(supabase: SupabaseClient, limit = 25, offset = 0): Promise<ProgressionLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_global")
    .select(LEADERBOARD_ENTRY_SELECT)
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(mapProgressionLeaderboardEntry);
}

export async function getMyChurchLeaderboard(supabase: SupabaseClient, limit = 25, offset = 0): Promise<ProgressionLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_my_church")
    .select(`${LEADERBOARD_ENTRY_SELECT}, church_id`)
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(mapProgressionLeaderboardEntry);
}
