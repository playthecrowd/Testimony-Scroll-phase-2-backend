import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BadgeDefinition,
  ProgressionLeaderboardEntry,
  MemberBadgeAward,
  MemberProgressionSummary,
  ProgressionLevelThreshold,
  ProgressionEventType,
} from "@/types";

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

// The signed-in member's own rank, even when far outside the top result page -- reads the same
// view (its rank column is computed over the full underlying data regardless of this row-level
// filter), never a second, separately-computed ranking.
export async function getMyGlobalRank(supabase: SupabaseClient): Promise<ProgressionLeaderboardEntry | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("leaderboard_global")
    .select(LEADERBOARD_ENTRY_SELECT)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProgressionLeaderboardEntry(data) : null;
}

export async function getMyChurchRank(supabase: SupabaseClient): Promise<ProgressionLeaderboardEntry | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("leaderboard_my_church")
    .select(`${LEADERBOARD_ENTRY_SELECT}, church_id`)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProgressionLeaderboardEntry(data) : null;
}

export async function getAllLevelThresholds(supabase: SupabaseClient): Promise<ProgressionLevelThreshold[]> {
  const { data, error } = await supabase
    .from("progression_level_thresholds")
    .select("id, level, min_xp, created_at")
    .order("level", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({ id: row.id, level: row.level, minXp: row.min_xp, createdAt: row.created_at }));
}

export interface ProgressionAwardLogEntry {
  id: string;
  eventType: ProgressionEventType;
  sourceRowId: string;
  pointsAwarded: number;
  xpAwarded: number;
  createdAt: string;
}

// Recent, human-readable award history for the signed-in member -- reads only their own rows
// (progression_award_log_select_own), never another member's. Source labels are derived from the
// fixed event_type enum only -- no raw internal id or idempotency key is ever surfaced by the
// caller of this function (see components/progression's presentation layer).
export async function getMyRecentProgressionAwards(supabase: SupabaseClient, limit = 20): Promise<ProgressionAwardLogEntry[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("progression_award_log")
    .select("id, event_type, source_row_id, points_awarded, xp_awarded, created_at")
    .eq("member_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    sourceRowId: row.source_row_id,
    pointsAwarded: row.points_awarded,
    xpAwarded: row.xp_awarded,
    createdAt: row.created_at,
  }));
}

// The exact award (if any) produced by one specific triggering row (e.g. a lesson_journeys id) --
// used for accurate, non-predictive completion feedback (Phase 11.4 SS11): "did THIS action just
// earn an award," answered from the real log, never guessed or computed client-side.
export async function getMyProgressionAwardForSourceRow(supabase: SupabaseClient, sourceRowId: string): Promise<ProgressionAwardLogEntry | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("progression_award_log")
    .select("id, event_type, source_row_id, points_awarded, xp_awarded, created_at")
    .eq("member_id", user.id)
    .eq("source_row_id", sourceRowId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        eventType: data.event_type,
        sourceRowId: data.source_row_id,
        pointsAwarded: data.points_awarded,
        xpAwarded: data.xp_awarded,
        createdAt: data.created_at,
      }
    : null;
}
