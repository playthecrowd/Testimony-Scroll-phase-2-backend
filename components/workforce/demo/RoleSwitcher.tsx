"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { WorkforceAvatar } from "@/components/workforce/WorkforceAvatar";
import { useWorkforcePreviewRole } from "./RoleContext";
import { PREVIEW_ROLES, PREVIEW_ROLE_LABEL, PREVIEW_ROLE_PERSON, WorkforcePageType, WorkforceNavContext, DEFAULT_NAV_CONTEXT, resolveRoleDestination } from "@/lib/workforcePreviewRole";
import { findPerson } from "@/lib/workforceDemo";

// The mandatory top-right role switcher (controlling spec section 2). Shows the active preview
// person/role and, on selection of a different role, navigates to that role's canonical page for
// the current shared decision/session context via resolveRoleDestination -- never a generic
// dashboard, per the spec's explicit fallback rule.
export function RoleSwitcher({ pageType, navContext = DEFAULT_NAV_CONTEXT }: { pageType: WorkforcePageType; navContext?: WorkforceNavContext }) {
  const { role, setRole } = useWorkforcePreviewRole();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const person = findPerson(PREVIEW_ROLE_PERSON[role]);

  function handleSelect(next: typeof role) {
    setOpen(false);
    if (next === role) return;
    setRole(next);
    router.push(resolveRoleDestination(pageType, next, navContext));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 focus-ring rounded-lg px-1 py-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <WorkforceAvatar name={person.name} imageUrl={person.portraitUrl} size="sm" />
        <div className="hidden sm:block leading-tight text-left">
          <div className="text-sm font-medium text-foreground">{person.name}</div>
          <div className="text-[11px] text-accent-gold font-medium">{PREVIEW_ROLE_LABEL[role]}</div>
        </div>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 qk-card rounded-xl p-2 z-50 shadow-lg">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Preview as role</div>
            {PREVIEW_ROLES.map((r) => {
              const p = findPerson(PREVIEW_ROLE_PERSON[r]);
              const active = r === role;
              return (
                <button
                  key={r}
                  onClick={() => handleSelect(r)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors ${active ? "bg-accent-blue/10" : "hover:bg-black/[0.03]"}`}
                >
                  <WorkforceAvatar name={p.name} imageUrl={p.portraitUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">{p.name}</div>
                    <div className="text-[10px] text-muted truncate">{PREVIEW_ROLE_LABEL[r]}</div>
                  </div>
                  {active && <Check size={14} className="text-accent-blue shrink-0" />}
                </button>
              );
            })}
            <div className="border-t border-border-subtle mt-1.5 pt-1.5">
              <button className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-muted hover:bg-black/[0.03] transition-colors" disabled>
                Profile
              </button>
              <button className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-muted hover:bg-black/[0.03] transition-colors" disabled>
                Account Settings
              </button>
              <button className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-muted hover:bg-black/[0.03] transition-colors" disabled>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
