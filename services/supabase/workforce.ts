import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkforceAccess, WorkforceRoleAssignment, WorkforceRole, WorkforceDepartment } from "@/types";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDepartment(row: any): WorkforceDepartment {
  return { id: row.id, churchId: row.church_id, name: row.name, createdBy: row.created_by, createdAt: row.created_at };
}

export async function listDepartments(supabase: SupabaseClient, churchId: string): Promise<WorkforceDepartment[]> {
  const { data, error } = await supabase.from("wf_departments").select("*").eq("church_id", churchId).order("name");
  if (error) throw error;
  return (data ?? []).map(mapDepartment);
}

// The signed-in profile's own display name, for the Workforce app shell's header -- separate from
// getWorkforceAccess since it's org-independent (a profile's name doesn't change per org).
export async function getMyProfileName(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data?.full_name ?? null;
}

// Best single role label for the header's role badge: platform_owner/enterprise_owner reuse
// existing Q4K concepts (private.is_church_manager -- see migration 0044's file header), so
// isManager takes priority display-wise over any explicit wf_role_assignments row. Otherwise the
// most senior held role wins, in spec section 5's own hierarchy order.
const ROLE_PRIORITY: WorkforceRole[] = ["stakeholder", "department_leadership", "manager", "employee", "intern", "vendor"];
const ROLE_BADGE_LABELS: Record<WorkforceRole, string> = {
  stakeholder: "Stakeholder",
  department_leadership: "Department Leadership",
  manager: "Manager",
  employee: "Employee",
  intern: "Intern / Apprentice",
  vendor: "Vendor",
};

export function getRoleBadgeLabel(access: WorkforceAccess): string {
  if (access.isManager) return "Enterprise Owner";
  for (const role of ROLE_PRIORITY) {
    if (access.roles.some((r) => r.role === role)) return ROLE_BADGE_LABELS[role];
  }
  return "Member";
}

// Where /workforce/login sends a signed-in user next -- mirrors authService.ts's
// resolvePostAuthDestination, but keyed on Workforce entitlement (getMyWorkforceOrganizations)
// instead of Q4K account_type, since Workforce access is org-membership-based, not a signup-tab
// choice. No org -> access-pending; exactly one -> straight into its Decision Pool; more than one
// -> the org picker at /workforce itself.
export async function resolveWorkforcePostAuthDestination(supabase: SupabaseClient): Promise<string> {
  const organizations = await getMyWorkforceOrganizations(supabase);
  if (organizations.length === 0) return "/workforce/access-pending";
  if (organizations.length === 1) return `/workforce/decisions?org=${organizations[0].churchId}`;
  return "/workforce";
}
