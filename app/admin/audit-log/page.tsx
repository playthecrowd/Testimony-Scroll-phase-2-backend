import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { getAdminAuditLog } from "@/lib/adminAuditLog";

export const dynamic = "force-dynamic";

// Eighth real admin page (Phase 9, docs/PHASE9_AUDIT.md) -- read side of admin_moderation_log,
// written by lib/adminAuditLog.ts's logAdminAction() from every status-changing admin action.
export default async function AdminAuditLogPage() {
  const supabase = await createClient();

  let gate;
  try {
    gate = await getPlatformAdminGate(supabase);
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    throw err;
  }

  if (!gate.userId) redirect("/login");
  if (!gate.isPlatformAdmin) return <NotAuthorized />;

  let entries: Awaited<ReturnType<typeof getAdminAuditLog>> = [];
  let loadError = "";
  try {
    entries = await getAdminAuditLog(supabase);
  } catch (err) {
    console.error("[AdminAuditLogPage] Failed to load audit log:", err);
    loadError = "We couldn't load the audit log right now. Please try again shortly.";
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Audit Log</h1>
        <Link href="/admin" className="text-xs text-accent-blue-light hover:underline">
          ← Admin Home
        </Link>
      </div>
      <p className="text-muted text-sm mb-6">Every moderation decision made across the admin tools, most recent first.</p>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : entries.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No moderation actions logged yet.</div>
      ) : (
        <div className="qk-card divide-y divide-border-subtle overflow-hidden">
          {entries.map((e) => (
            <div key={e.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {e.action.replace(/_/g, " ")} <span className="text-muted font-normal">· {e.entityType}</span>
                </p>
                {e.detail && <p className="text-xs text-muted truncate">{e.detail}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted">{e.actorName ?? "Unknown admin"}</p>
                <p className="text-[11px] text-muted">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
