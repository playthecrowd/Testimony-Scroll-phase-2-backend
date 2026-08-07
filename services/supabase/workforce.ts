import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkforceAccess, WorkforceRoleAssignment, WorkforceRole } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoleAssignment(row: any): WorkforceRoleAssignment {
  return {
    id: row.id,
    churchId: row.church_id,
    profileId: row.profile_id,
    role: row.role as WorkforceRole,
    departmentId: row.department_id,
    createdAt: row.created_at,
  };
}

// The single entry-point check for "may this signed-in profile use Workforce for this org."
// Combines wf_module_settings.enabled with private.is_church_manager (via the church_memberships
// query below, mirroring getMyHostChurches' own pattern rather than re-deriving manager status
// client-side) and every wf_role_assignments row the profile holds. Managers are always allowed
// in regardless of `enabled`, so they can reach the settings screen that turns it on in the first
// place -- matches wf_module_settings' own RLS (managers can always SELECT/INSERT/UPDATE it).
export async function getWorkforceAccess(supabase: SupabaseClient, churchId: string): Promise<WorkforceAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { churchId, entitled: false, isManager: false, roles: [] };
  }

  const [{ data: settings, error: settingsError }, { data: membership, error: membershipError }, { data: roleRows, error: roleError }] =
    await Promise.all([
      supabase.from("wf_module_settings").select("enabled").eq("church_id", churchId).maybeSingle(),
      supabase
        .from("church_memberships")
        .select("role")
        .eq("church_id", churchId)
        .eq("profile_id", user.id)
        .in("role", ["host", "admin"])
        .maybeSingle(),
      supabase.from("wf_role_assignments").select("*").eq("church_id", churchId).eq("profile_id", user.id),
    ]);
  if (settingsError) throw settingsError;
  if (membershipError) throw membershipError;
  if (roleError) throw roleError;

  const isManager = !!membership;
  const roles = (roleRows ?? []).map(mapRoleAssignment);

  return {
    churchId,
    entitled: isManager || settings?.enabled === true || roles.length > 0,
    isManager,
    roles,
  };
}

// Every org the signed-in profile could plausibly reach a Workforce screen for: orgs they manage
// (host/admin membership on an entity_type = 'organization' church) plus orgs where they hold at
// least one wf_role_assignments row. A profile with neither has nothing to show on /workforce yet.
export async function getMyWorkforceOrganizations(
  supabase: SupabaseClient
): Promise<{ churchId: string; name: string; isManager: boolean }[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: managed, error: managedError }, { data: roleOrgs, error: roleError }] = await Promise.all([
    supabase
      .from("church_memberships")
      .select("role, church:churches!inner(id, name, entity_type)")
      .eq("profile_id", user.id)
      .in("role", ["host", "admin"])
      .eq("church.entity_type", "organization"),
    supabase
      .from("wf_role_assignments")
      .select("church:churches!inner(id, name, entity_type)")
      .eq("profile_id", user.id)
      .eq("church.entity_type", "organization"),
  ]);
  if (managedError) throw managedError;
  if (roleError) throw roleError;

  const byId = new Map<string, { churchId: string; name: string; isManager: boolean }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (managed ?? []).forEach((row: any) => {
    if (!row.church) return;
    byId.set(row.church.id, { churchId: row.church.id, name: row.church.name, isManager: true });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (roleOrgs ?? []).forEach((row: any) => {
    if (!row.church || byId.has(row.church.id)) return;
    byId.set(row.church.id, { churchId: row.church.id, name: row.church.name, isManager: false });
  });

  return Array.from(byId.values());
}
