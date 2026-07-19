import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  detail?: string;
}

// Called from every existing status-changing admin action (lesson requests, testimonies, events,
// character/episode publish) right after the real write succeeds -- "log important moderation
// status changes where practical" (Part 19). Every caller has already passed requirePlatformAdmin()
// before reaching this point, so actor_id is trustworthy here even though it's set from the
// caller's own session rather than re-derived. Best-effort: a logging failure must never make an
// otherwise-successful moderation action look like it failed, so callers should not let a thrown
// error here block their own response -- this function swallows its own errors and just logs to
// the server console instead.
export async function logAdminAction(supabase: SupabaseClient, entry: AdminLogEntry): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("admin_moderation_log").insert({
    actor_id: user.id,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    detail: entry.detail ?? null,
  });
  if (error) console.error("[logAdminAction] Failed to write audit log entry:", error);
}

export interface AdminLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
  actorName: string | null;
}

// Read side for app/admin/audit-log/page.tsx. RLS (admin_moderation_log_select_admin) already
// restricts this to platform admins, so no extra gate is needed here beyond the page-level
// getPlatformAdminGate() every /admin/* page already calls.
export async function getAdminAuditLog(supabase: SupabaseClient, limit = 200): Promise<AdminLogRow[]> {
  const { data, error } = await supabase
    .from("admin_moderation_log")
    .select("id, action, entity_type, entity_id, detail, created_at, actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = row.actor as any;
    return {
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      detail: row.detail,
      createdAt: row.created_at,
      actorName: actor?.full_name ?? actor?.email ?? null,
    };
  });
}
