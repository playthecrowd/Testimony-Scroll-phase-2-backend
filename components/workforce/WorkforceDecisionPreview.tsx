"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Trophy, BarChart3, FileText, Activity, MoreHorizontal, X, Pencil, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WorkforceDecisionStatusBadge } from "./WorkforceDecisionStatusBadge";
import { DecisionHeroVisual } from "./DecisionHeroVisual";
import { DecisionMetadataPanel } from "./DecisionMetadataPanel";
import { DecisionAccordion } from "./DecisionAccordion";
import { DecisionTeamHierarchy } from "./DecisionTeamHierarchy";
import { InvitationAction } from "./InvitationAction";
import { ApprovalRoute } from "./ApprovalRoute";
import { InvitedGroupCard } from "./InvitedGroupCard";
import { OtherDecisionRail } from "./OtherDecisionRail";
import {
  trackDecision,
  createInvitationRequest,
  reviewInvitationRequest,
  findOrgMemberByEmail,
} from "@/services/supabase/workforceDecisions";
import {
  WorkforceDecision,
  WorkforceDecisionParticipant,
  WorkforceDecisionInvitationRequest,
  WorkforceDepartment,
} from "@/types";

// The WF-02 Stakeholder Decision Preview layout, rebuilt to match the reference screenshot's
// structure directly rather than a generic stack of full-width cards: header actions, a hero
// visual beside a narrow metadata panel, compact collapsed-by-default content cards, a dedicated
// Decision Team column, and an Other Decisions rail -- three content columns beside the Workforce
// shell's own left nav. Every interaction below calls the exact same service functions the
// previous layout did (trackDecision, createInvitationRequest, reviewInvitationRequest,
// findOrgMemberByEmail) -- this is a visual rebuild, not a behavior change.
export function WorkforceDecisionPreview({
  decision,
  participants,
  invitationRequests: initialRequests,
  departments,
  isManager,
  canReview,
  otherDecisions,
  totalDecisionsCount,
}: {
  decision: WorkforceDecision;
  participants: WorkforceDecisionParticipant[];
  invitationRequests: WorkforceDecisionInvitationRequest[];
  departments: WorkforceDepartment[];
  isManager: boolean;
  canReview: boolean;
  otherDecisions: WorkforceDecision[];
  totalDecisionsCount: number;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [message, setMessage] = useState("");

  // "Track This Decision" is the sole primary action now that the separate "Open Decision
  // Workspace" button is gone -- it must both record tracking (unchanged trackDecision call) and
  // land the user in the workspace, matching the reference layout's single-CTA header.
  async function handleTrack() {
    setTracking(true);
    setMessage("");
    try {
      const supabase = createClient();
      await trackDecision(supabase, decision);
      setTracked(true);
      router.push(`/workforce/decisions/${decision.id}/workspace`);
    } catch {
      setMessage("We could not save this change. Your previous information is still available.");
      setTracking(false);
    }
  }

  async function submitDepartmentInvite(scope: "department" | "department_leadership", departmentId: string) {
    const supabase = createClient();
    await createInvitationRequest(supabase, { decisionId: decision.id, churchId: decision.churchId, targetScope: scope, departmentId });
    setMessage("Your participant request was sent for approval.");
  }

  async function submitPersonInvite(email: string) {
    const supabase = createClient();
    const target = await findOrgMemberByEmail(supabase, decision.churchId, email);
    if (!target) return { error: "No one in this organization matches that email." };
    await createInvitationRequest(supabase, { decisionId: decision.id, churchId: decision.churchId, targetScope: "specific_person", targetProfileId: target.id });
    setMessage("Your participant request was sent for approval.");
  }

  async function handleReview(request: WorkforceDecisionInvitationRequest, approve: boolean) {
    try {
      const supabase = createClient();
      await reviewInvitationRequest(supabase, request, approve);
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: approve ? "approved" : "declined" } : r)));
      if (approve) setMessage("Invitations sent.");
    } catch {
      setMessage("We could not save this change. Your previous information is still available.");
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const groupedByRole = participants.reduce<Record<string, string[]>>((acc, p) => {
    const key = p.role.replace(/_/g, " ");
    (acc[key] ??= []).push(p.profileName ?? "Unnamed");
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px_300px] gap-6 items-start">
      {/* Main decision content */}
      <div className="space-y-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted mb-1">
              <Link href={`/workforce/decisions?org=${decision.churchId}`} className="hover:text-accent-blue">
                Decision Pool
              </Link>{" "}
              / {decision.decisionNumber}
            </div>
            <h1 className="text-2xl md:text-[28px] font-bold text-foreground leading-tight">{decision.title}</h1>
            <div className="mt-2">
              <WorkforceDecisionStatusBadge status={decision.status} />
            </div>
            {decision.executiveIntent && <p className="text-sm text-muted mt-2 max-w-xl">{decision.executiveIntent}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTrack}
              disabled={tracking || tracked}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg bg-accent-blue text-[#16210a] hover:bg-accent-blue-light transition-colors disabled:opacity-60"
            >
              {tracked ? "Tracking" : tracking ? "Saving..." : "Track This Decision"}
            </button>
            <button className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2.5 rounded-lg border border-border-subtle text-foreground hover:border-accent-blue transition-colors">
              <Pencil size={14} /> Edit Decision
            </button>
            <button className="p-2.5 rounded-lg border border-border-subtle text-muted hover:text-foreground" aria-label="More actions">
              <MoreHorizontal size={16} />
            </button>
            <Link
              href={`/workforce/decisions?org=${decision.churchId}`}
              className="p-2.5 rounded-lg border border-border-subtle text-muted hover:text-foreground"
              aria-label="Close"
            >
              <X size={16} />
            </Link>
          </div>
        </div>
        {message && <p className="text-sm text-accent-blue">{message}</p>}

        {/* flex-col-reverse puts the hero first on mobile (DOM order: metadata, hero -- reversed
            visually) while sm:flex-row restores normal left-to-right order at tablet/desktop. */}
        <div className="flex flex-col-reverse sm:flex-row gap-4 items-stretch">
          <div className="sm:w-[240px] shrink-0">
            <DecisionMetadataPanel decision={decision} />
          </div>
          <div className="flex-1 min-w-0">
            <DecisionHeroVisual title={decision.title} />
          </div>
        </div>

        <div className="space-y-3">
          <DecisionAccordion icon={Target} heading="Executive Intent" preview={decision.executiveIntent || "Not yet provided."}>
            {decision.executiveIntent || "Not yet provided."}
          </DecisionAccordion>
          <DecisionAccordion icon={Trophy} heading="Desired Outcome" preview={decision.desiredOutcome || "Not yet provided."}>
            {decision.desiredOutcome || "Not yet provided."}
          </DecisionAccordion>
          <DecisionAccordion icon={BarChart3} heading="Success Measures" preview="Not yet defined.">
            Success measures ship with the Decision Workspace.
          </DecisionAccordion>
          <DecisionAccordion icon={FileText} heading="Supporting Files (0)" preview="No files yet.">
            File attachments ship in a later phase.
          </DecisionAccordion>
          <DecisionAccordion icon={Activity} heading="Activity" preview={`Created ${new Date(decision.createdAt).toLocaleDateString()}`}>
            Full audit trail ships with the Decision Workspace.
          </DecisionAccordion>
        </div>
      </div>

      {/* Build the Decision Team panel. A native <details> gives this a real collapse/expand
          affordance below xl (where it stacks in-flow like an accordion) while staying always-open
          and non-interactive-looking at xl+, where it's a persistent sidebar column. Defaulting to
          `open` keeps every control reachable without JS -- nothing is hidden by default. */}
      <details open className="qk-card rounded-2xl p-4 group">
        <summary className="flex items-center justify-between gap-2 cursor-pointer xl:cursor-default list-none [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Build the Decision Team</h2>
            <p className="text-xs text-muted mt-0.5">Invite each level through the appropriate reporting chain.</p>
          </div>
          <ChevronDown size={16} className="text-muted shrink-0 xl:hidden transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 mt-4">
        <DecisionTeamHierarchy
          step2Actions={
            <div className="flex flex-wrap gap-2">
              <InvitationAction
                label="Invite Departments"
                kind="department"
                departments={departments}
                onSubmit={(value) => submitDepartmentInvite("department", value)}
              />
              <InvitationAction
                label="Invite Department Leadership"
                kind="department"
                departments={departments}
                onSubmit={(value) => submitDepartmentInvite("department_leadership", value)}
              />
            </div>
          }
        />

        {isManager && (
          <InvitationAction label="Request a Specific Person" kind="specific_person" onSubmit={submitPersonInvite} fullWidth />
        )}
        <p className="text-[11px] text-muted -mt-2">
          Requests route to the person&apos;s department or manager for approval. Leadership is notified.
        </p>

        <ApprovalRoute />

        <div>
          <h3 className="text-xs font-semibold text-foreground mb-2">Current Invited Groups</h3>
          {Object.keys(groupedByRole).length === 0 ? (
            <p className="text-xs text-muted">No participants yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(groupedByRole).map(([role, names]) => (
                <InvitedGroupCard key={role} label={role} names={names} />
              ))}
            </div>
          )}
        </div>

        {canReview && pendingRequests.length > 0 && (
          <div className="pt-3 border-t border-border-subtle space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pending Requests</h3>
            {pendingRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground capitalize">{r.targetScope.replace(/_/g, " ")}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleReview(r, true)} className="text-xs text-accent-blue hover:underline">
                    Approve
                  </button>
                  <button onClick={() => handleReview(r, false)} className="text-xs text-muted hover:underline">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted pt-2 border-t border-border-subtle">
          {participants.length} {participants.length === 1 ? "participant" : "participants"} invited
          {pendingRequests.length > 0 ? ` • ${pendingRequests.length} response${pendingRequests.length === 1 ? "" : "s"} pending` : ""}
        </p>
        </div>
      </details>

      {/* Other Decisions rail */}
      <OtherDecisionRail decisions={otherDecisions} churchId={decision.churchId} totalCount={totalDecisionsCount} />
    </div>
  );
}
