"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { WorkforceDecisionStatusBadge } from "./WorkforceDecisionStatusBadge";
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
  WorkforceInvitationTargetScope,
} from "@/types";

const SECTION_CLASS = "qk-card p-5 space-y-2";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function DecisionPreviewClient({
  decision,
  participants: initialParticipants,
  invitationRequests: initialRequests,
  departments,
  isManager,
  canReview,
}: {
  decision: WorkforceDecision;
  participants: WorkforceDecisionParticipant[];
  invitationRequests: WorkforceDecisionInvitationRequest[];
  departments: WorkforceDepartment[];
  isManager: boolean;
  canReview: boolean;
}) {
  // Read-only from the server-fetched props -- a full refresh (e.g. navigating back into this
  // page) picks up any change made by trackDecision/reviewInvitationRequest below. Only `requests`
  // needs live client state, so its own Approve/Decline buttons can disable immediately.
  const participants = initialParticipants;
  const [requests, setRequests] = useState(initialRequests);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteScope, setInviteScope] = useState<WorkforceInvitationTargetScope | null>(null);
  const [inviteDepartmentId, setInviteDepartmentId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function handleTrack() {
    setTracking(true);
    setMessage("");
    try {
      const supabase = createClient();
      await trackDecision(supabase, decision);
      setTracked(true);
      setMessage("You are now tracking this decision.");
    } catch {
      setMessage("We could not save this change. Your previous information is still available.");
    } finally {
      setTracking(false);
    }
  }

  async function submitInvite() {
    if (!inviteScope) return;
    setInviteBusy(true);
    setInviteError("");
    try {
      const supabase = createClient();
      if (inviteScope === "specific_person") {
        const target = await findOrgMemberByEmail(supabase, decision.churchId, inviteEmail);
        if (!target) {
          setInviteError("No one in this organization matches that email.");
          setInviteBusy(false);
          return;
        }
        await createInvitationRequest(supabase, {
          decisionId: decision.id,
          churchId: decision.churchId,
          targetScope: "specific_person",
          targetProfileId: target.id,
        });
      } else {
        if (!inviteDepartmentId) {
          setInviteError("Choose a department.");
          setInviteBusy(false);
          return;
        }
        await createInvitationRequest(supabase, {
          decisionId: decision.id,
          churchId: decision.churchId,
          targetScope: inviteScope,
          departmentId: inviteDepartmentId,
        });
      }
      setMessage("Your participant request was sent for approval.");
      setInviteScope(null);
      setInviteDepartmentId("");
      setInviteEmail("");
    } catch {
      setInviteError("We could not save this change. Your previous information is still available.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleReview(request: WorkforceDecisionInvitationRequest, approve: boolean) {
    try {
      const supabase = createClient();
      await reviewInvitationRequest(supabase, request, approve);
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: approve ? "approved" : "declined" } : r)));
      if (approve) {
        // Re-fetch would be more precise, but a light client-side refresh is enough for Phase 2
        // scaffolding -- the server-rendered page reflects the true state on next navigation.
        setMessage("Invitations sent.");
      }
    } catch {
      setMessage("We could not save this change. Your previous information is still available.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted">{decision.decisionNumber}</span>
            <WorkforceDecisionStatusBadge status={decision.status} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{decision.title}</h1>
        </div>
        <Button onClick={handleTrack} disabled={tracking || tracked}>
          {tracked ? "Tracking" : tracking ? "Saving..." : "Track This Decision"}
        </Button>
      </div>
      {message && <p className="text-sm text-accent-blue-light">{message}</p>}
      {tracked && <p className="text-xs text-muted">The full Decision Workspace ships in a later phase -- this decision is now on your list.</p>}

      <div className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold text-foreground">Executive Intent</h2>
        <p className="text-sm text-muted">{decision.executiveIntent || "Not yet provided."}</p>
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold text-foreground">Desired Outcome</h2>
        <p className="text-sm text-muted">{decision.desiredOutcome || "Not yet provided."}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className={SECTION_CLASS}>
          <span className="text-xs text-muted">Owner</span>
          <p className="text-sm text-foreground">{decision.decisionOwnerName ?? "Unassigned"}</p>
        </div>
        <div className={SECTION_CLASS}>
          <span className="text-xs text-muted">Controlling Stakeholder</span>
          <p className="text-sm text-foreground">{decision.controllingStakeholderGroup ?? "Not set"}</p>
        </div>
        <div className={SECTION_CLASS}>
          <span className="text-xs text-muted">Target Date</span>
          <p className="text-sm text-foreground">{formatDate(decision.targetDate)}</p>
        </div>
        <div className={SECTION_CLASS}>
          <span className="text-xs text-muted">Priority</span>
          <p className="text-sm text-foreground capitalize">{decision.priority}</p>
        </div>
        <div className={SECTION_CLASS}>
          <span className="text-xs text-muted">Security</span>
          <p className="text-sm text-foreground capitalize">{decision.security}</p>
        </div>
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold text-foreground">Supporting Files</h2>
        <p className="text-sm text-muted">No files yet. File attachments ship in a later phase.</p>
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold text-foreground">Build the Decision Team</h2>
        <p className="text-xs text-muted mb-2">Invite each level through the appropriate reporting chain.</p>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setInviteScope(inviteScope === "department" ? null : "department")}
            className="text-xs px-3 py-1.5 rounded-lg border border-border-subtle hover:border-accent-blue-light/50"
          >
            Invite Departments
          </button>
          <button
            onClick={() => setInviteScope(inviteScope === "department_leadership" ? null : "department_leadership")}
            className="text-xs px-3 py-1.5 rounded-lg border border-border-subtle hover:border-accent-blue-light/50"
          >
            Invite Department Leadership
          </button>
          {isManager && (
            <button
              onClick={() => setInviteScope(inviteScope === "specific_person" ? null : "specific_person")}
              className="text-xs px-3 py-1.5 rounded-lg border border-border-subtle hover:border-accent-blue-light/50"
            >
              Request a Specific Person
            </button>
          )}
        </div>

        {inviteScope && (
          <div className="bg-surface-2 border border-border-subtle rounded-lg p-3 space-y-2 mb-3">
            {inviteScope === "specific_person" ? (
              <>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-muted">
                  Requests are routed to the person&apos;s department or manager for approval. Decision leadership is notified.
                </p>
              </>
            ) : (
              <select
                value={inviteDepartmentId}
                onChange={(e) => setInviteDepartmentId(e.target.value)}
                className="w-full bg-background border border-border-subtle rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Choose a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            {inviteError && <p className="text-xs text-red-300">{inviteError}</p>}
            <Button size="sm" onClick={submitInvite} disabled={inviteBusy}>
              {inviteBusy ? "Sending..." : "Send Request"}
            </Button>
          </div>
        )}

        {participants.length === 0 ? (
          <p className="text-sm text-muted">No participants yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {participants.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-foreground">{p.profileName ?? "Unnamed"}</span>
                <span className="text-xs text-muted capitalize">{p.role.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}

        {canReview && requests.some((r) => r.status === "pending") && (
          <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Pending Requests</h3>
            {requests
              .filter((r) => r.status === "pending")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground capitalize">{r.targetScope.replace("_", " ")}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleReview(r, true)} className="text-xs text-accent-blue-light hover:underline">
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
      </div>

      <div className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <p className="text-sm text-muted">Audit trail ships with the Decision Workspace in a later phase.</p>
      </div>
    </div>
  );
}
