"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  advanceDecisionStage,
  approveStage,
  addDecisionFeedback,
  listDecisionStages,
} from "@/services/supabase/workforceStages";
import { assignExperience, assignExperienceManager, removeExperienceAssignmentManager } from "@/services/supabase/workforceExperiences";
import {
  WorkforceDecision,
  WorkforceDecisionStage,
  WorkforceDecisionStageTransition,
  WorkforceDecisionFeedback,
  WorkforceExperienceTemplate,
  WorkforceExperienceAssignment,
  WorkforceDepartment,
} from "@/types";

const ROLE_TRACK = [
  { key: "stakeholder", label: "Stakeholder" },
  { key: "department_leadership", label: "Department Leadership" },
  { key: "manager", label: "Managers" },
  { key: "employee", label: "Employees" },
] as const;

// Every stage in this pathway maps its key to the role track step that owns it -- used only to
// highlight "where we are" on the WF-04 role track, not a second source of truth for status.
const STAGE_TO_ROLE_STEP: Record<string, (typeof ROLE_TRACK)[number]["key"]> = {
  stakeholder_review: "stakeholder",
  awaiting_leadership_approval: "stakeholder",
  department_translation: "department_leadership",
  management_planning: "manager",
  employee_activation: "employee",
  in_implementation: "employee",
  measuring_outcomes: "employee",
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function DecisionWorkspaceClient({
  decision,
  stages: initialStages,
  transitions,
  feedback: initialFeedback,
  templates,
  assignments: initialAssignments,
  department,
  departmentManagers,
  canAdvance,
  isManager,
  canManageExperiences,
}: {
  decision: WorkforceDecision;
  stages: WorkforceDecisionStage[];
  transitions: WorkforceDecisionStageTransition[];
  feedback: WorkforceDecisionFeedback[];
  templates: WorkforceExperienceTemplate[];
  assignments: WorkforceExperienceAssignment[];
  department: WorkforceDepartment | null;
  departmentManagers: { profileId: string; profileName: string | null }[];
  canAdvance: boolean;
  isManager: boolean;
  canManageExperiences: boolean;
}) {
  const [stages, setStages] = useState(initialStages);
  const [decisionStatus, setDecisionStatus] = useState(decision.status);
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const [feedback, setFeedback] = useState(initialFeedback);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customizationNotes, setCustomizationNotes] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState("");

  const currentIndex = STAGE_ORDER.indexOf(decisionStatus as (typeof STAGE_ORDER)[number]);
  const currentStage = currentIndex >= 0 ? stages.find((s) => s.stageKey === STAGE_ORDER[currentIndex]) : null;
  const currentRoleStep = currentStage ? STAGE_TO_ROLE_STEP[currentStage.stageKey] : null;

  async function handleAdvance() {
    setAdvanceBusy(true);
    setAdvanceError("");
    try {
      const supabase = createClient();
      const result = await advanceDecisionStage(supabase, { ...decision, status: decisionStatus }, stages);
      setDecisionStatus(result.decisionStatus as typeof decisionStatus);
      setStages(await listDecisionStages(supabase, decision.id));
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : "We could not save this change. Your previous information is still available.");
    } finally {
      setAdvanceBusy(false);
    }
  }

  async function handleApprove(stageId: string) {
    try {
      const supabase = createClient();
      await approveStage(supabase, stageId);
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, approvedAt: new Date().toISOString() } : s)));
    } catch {
      setAdvanceError("We could not save this change. Your previous information is still available.");
    }
  }

  async function handleAddFeedback() {
    if (!feedbackBody.trim()) return;
    setFeedbackBusy(true);
    try {
      const supabase = createClient();
      await addDecisionFeedback(supabase, decision.id, feedbackBody, currentStage?.stageKey ?? null);
      setFeedback((prev) => [{ id: crypto.randomUUID(), decisionId: decision.id, stageKey: currentStage?.stageKey ?? null, authorProfileId: null, authorName: "You", body: feedbackBody.trim(), createdAt: new Date().toISOString() }, ...prev]);
      setFeedbackBody("");
    } catch {
      setAdvanceError("We could not save this change. Your previous information is still available.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function handleAssign() {
    if (!selectedTemplateId) {
      setAssignError("Choose an experience.");
      return;
    }
    setAssignBusy(true);
    setAssignError("");
    try {
      const supabase = createClient();
      const created = await assignExperience(supabase, decision.id, selectedTemplateId, customizationNotes);
      const template = templates.find((t) => t.id === selectedTemplateId) ?? null;
      setAssignments((prev) => [...prev, { ...created, template }]);
      setSelectedTemplateId("");
      setCustomizationNotes("");
    } catch {
      setAssignError("We could not save this change. Your previous information is still available.");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleAssignManager(assignmentId: string, profileId: string) {
    try {
      const supabase = createClient();
      await assignExperienceManager(supabase, assignmentId, profileId);
      const manager = departmentManagers.find((m) => m.profileId === profileId);
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, managers: [...a.managers.filter((m) => m.profileId !== profileId), { profileId, profileName: manager?.profileName ?? null }] } : a))
      );
    } catch {
      setAssignError("We could not save this change. Your previous information is still available.");
    }
  }

  async function handleRemoveManager(assignmentId: string, profileId: string) {
    try {
      const supabase = createClient();
      await removeExperienceAssignmentManager(supabase, assignmentId, profileId);
      setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, managers: a.managers.filter((m) => m.profileId !== profileId) } : a)));
    } catch {
      setAssignError("We could not save this change. Your previous information is still available.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Pathway */}
      <section className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Pathway</h1>
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.map((key, index) => {
            const stage = stages.find((s) => s.stageKey === key);
            const isCurrent = index === currentIndex;
            return (
              <div
                key={key}
                className={`px-3 py-2 rounded-lg border text-xs min-w-[130px] ${
                  isCurrent ? "border-accent-blue-light bg-accent-blue/10" : stage?.status === "complete" ? "border-green-500/30 bg-green-500/5" : "border-border-subtle"
                }`}
              >
                <div className="font-medium text-foreground">{STAGE_LABELS[key]}</div>
                {isCurrent && <div className="text-accent-blue-light mt-0.5">Decision currently here</div>}
                {stage?.status === "complete" && <div className="text-green-300 mt-0.5">Complete</div>}
              </div>
            );
          })}
        </div>

        {currentStage ? (
          <div className="qk-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{STAGE_LABELS[currentStage.stageKey]}</h2>
              {currentStage.requiresApproval && (
                <span className={`text-[11px] ${currentStage.approvedAt ? "text-green-300" : "text-accent-gold"}`}>
                  {currentStage.approvedAt ? "Approved" : "Awaiting approval"}
                </span>
              )}
            </div>
            {currentStage.objective && <p className="text-sm text-muted">{currentStage.objective}</p>}
            {currentStage.requiresApproval && !currentStage.approvedAt && (
              <p className="text-xs text-muted">This proposal must be approved by the decision&apos;s authorized leadership before participants are invited.</p>
            )}
            <div className="flex gap-2 pt-1">
              {currentStage.requiresApproval && !currentStage.approvedAt && isManager && (
                <Button size="sm" variant="outline" onClick={() => handleApprove(currentStage.id)}>
                  Approve Proposal
                </Button>
              )}
              {canAdvance && (
                <Button size="sm" onClick={handleAdvance} disabled={advanceBusy}>
                  {advanceBusy ? "Saving..." : "Open Stage Workspace"}
                </Button>
              )}
            </div>
          </div>
        ) : decisionStatus === "draft" && canAdvance ? (
          <Button size="sm" onClick={handleAdvance} disabled={advanceBusy}>
            {advanceBusy ? "Starting..." : "Start Pathway"}
          </Button>
        ) : (
          <p className="text-sm text-muted capitalize">{decisionStatus.replace(/_/g, " ")}</p>
        )}
        {advanceError && <p className="text-xs text-red-300">{advanceError}</p>}

        {transitions.length > 0 && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Transition history ({transitions.length})</summary>
            <ul className="mt-2 space-y-1">
              {transitions.map((t) => (
                <li key={t.id}>
                  {formatDateTime(t.createdAt)} — {t.fromStageKey ? STAGE_LABELS[t.fromStageKey] : "Draft"} → {STAGE_LABELS[t.toStageKey]}
                  {t.changedByName ? ` (${t.changedByName})` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Feedback */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Feedback</h2>
        <div className="flex gap-2">
          <input
            value={feedbackBody}
            onChange={(e) => setFeedbackBody(e.target.value)}
            placeholder="Share feedback on this decision..."
            className="flex-1 bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={handleAddFeedback} disabled={feedbackBusy || !feedbackBody.trim()}>
            Post
          </Button>
        </div>
        {feedback.length > 0 && (
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li key={f.id} className="qk-card p-3 text-sm">
                <div className="text-xs text-muted mb-1">
                  {f.authorName ?? "Unnamed"} · {formatDateTime(f.createdAt)}
                </div>
                {f.body}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Department Breakout */}
      <section className="space-y-4 pt-4 border-t border-white/10">
        <h1 className="text-xl font-bold text-foreground">Department Breakout</h1>
        <p className="text-sm text-muted">{department ? department.name : "No department assigned yet."}</p>

        <div className="flex flex-wrap gap-2">
          {ROLE_TRACK.map((step) => (
            <div
              key={step.key}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                step.key === currentRoleStep ? "border-accent-blue-light text-accent-blue-light" : "border-border-subtle text-muted"
              }`}
            >
              {step.label}
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Future Factory Experience Catalog</h2>
          <p className="text-xs text-muted mb-3">Select a purpose-built experience to help your managers communicate, demonstrate, train, or validate this decision.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="qk-card p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-accent-gold">{t.communicationFocus.replace(/_/g, " ")}</div>
                <div className="text-sm font-medium text-foreground">{t.title}</div>
                <p className="text-xs text-muted">{t.description}</p>
              </div>
            ))}
          </div>
        </div>

        {canManageExperiences && (
          <div className="qk-card p-3 space-y-2">
            <h3 className="text-xs font-semibold text-foreground">Select &amp; Assign</h3>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Choose an experience</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <textarea
              value={customizationNotes}
              onChange={(e) => setCustomizationNotes(e.target.value)}
              placeholder="Customization notes for Plotabl (optional)"
              rows={2}
              className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted">Plotabl and approved delivery partners will scope and produce the custom experience after approval.</p>
            {assignError && <p className="text-xs text-red-300">{assignError}</p>}
            <Button size="sm" onClick={handleAssign} disabled={assignBusy}>
              {assignBusy ? "Assigning..." : "Create Session Proposal"}
            </Button>
          </div>
        )}

        {assignments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground">Assigned Experiences</h3>
            {assignments.map((a) => (
              <div key={a.id} className="qk-card p-3 space-y-2">
                <div className="text-sm font-medium text-foreground">{a.template?.title ?? "Experience"}</div>
                {a.customizationNotes && <p className="text-xs text-muted">{a.customizationNotes}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {a.managers.map((m) => (
                    <span key={m.profileId} className="text-[11px] bg-surface-2 border border-border-subtle rounded-full px-2 py-0.5 flex items-center gap-1">
                      {m.profileName ?? "Unnamed"}
                      {canManageExperiences && (
                        <button onClick={() => handleRemoveManager(a.id, m.profileId)} className="text-muted hover:text-red-300">
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {canManageExperiences && departmentManagers.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleAssignManager(a.id, e.target.value);
                      e.target.value = "";
                    }}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="">Assign a manager...</option>
                    {departmentManagers
                      .filter((m) => !a.managers.some((am) => am.profileId === m.profileId))
                      .map((m) => (
                        <option key={m.profileId} value={m.profileId}>
                          {m.profileName ?? "Unnamed"}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
