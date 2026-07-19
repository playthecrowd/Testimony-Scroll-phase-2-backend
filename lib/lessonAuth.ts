// Mirrors private.is_church_manager() -- a church_memberships row with role 'host' or 'admin'.
// This is a UX-layer mirror only; the real gate is always the church_memberships query itself
// plus RLS, never this predicate alone.
export function hasChurchEditAccess(role: string | null | undefined): boolean {
  return role === "host" || role === "admin";
}
