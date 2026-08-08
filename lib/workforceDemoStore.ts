// Shared mutable demo state -- the pieces of /workforce/demo/** state that must be visible from
// every role, not just the role that changed them (a Manager's invite must show "Confirmed" once
// the Employee accepts it; a saved moment must appear in the Manager's Archive once shared; a
// completed checkpoint must show up in Manager Analytics). lib/workforceDemo.ts stays the
// read-only seed data; this is the mutable layer on top of it, persisted the same way the active
// preview role already is (see components/workforce/demo/RoleContext.tsx) so it survives both
// client-side navigation and a hard refresh.

export type WorkforceDemoSessionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "onboarding"
  | "ready"
  | "live"
  | "completed"
  | "cancelled";

export type WorkforceDemoProposalStatus = "draft" | "pending_approval" | "changes_requested" | "resubmitted" | "approved" | "rejected" | "cancelled";

export type WorkforceDemoInvitationStatus = "not_invited" | "invited" | "confirmed" | "declined";

export interface WorkforceDemoInvitationState {
  status: WorkforceDemoInvitationStatus;
  deviceCheck: boolean;
  avatarReady: boolean;
  admitted: boolean;
}

export interface WorkforceDemoSavedMomentState {
  id: string;
  personId: string;
  note: string;
  timestamp: string;
  shared: boolean;
}

export interface WorkforceDemoFeedbackCommentState {
  id: string;
  personId: string;
  body: string;
  stageIndex: number;
  resolved: boolean;
  timestamp: string;
}

export interface WorkforceDemoStoreState {
  sessionStatus: WorkforceDemoSessionStatus;
  proposalStatus: WorkforceDemoProposalStatus;
  admissionOpen: boolean;
  invitations: Record<string, WorkforceDemoInvitationState>;
  checkpointsCompleted: number;
  totalCheckpoints: number;
  savedMoments: WorkforceDemoSavedMomentState[];
  leadershipContentStatus: Record<string, "draft" | "released" | "withdrawn">;
  feedbackComments: WorkforceDemoFeedbackCommentState[];
  decisionStageIndex: number;
}

const NAMED_EMPLOYEE_IDS = ["ava-patel", "leah-morgan", "marcus-allen", "nia-coleman", "kevin-zhao", "rachel-simmons"];

export const DEFAULT_STORE_STATE: WorkforceDemoStoreState = {
  sessionStatus: "scheduled",
  proposalStatus: "pending_approval",
  admissionOpen: false,
  invitations: {
    "ava-patel": { status: "confirmed", deviceCheck: true, avatarReady: true, admitted: false },
    "leah-morgan": { status: "invited", deviceCheck: true, avatarReady: false, admitted: false },
    "marcus-allen": { status: "confirmed", deviceCheck: false, avatarReady: false, admitted: false },
    "nia-coleman": { status: "invited", deviceCheck: false, avatarReady: false, admitted: false },
    "kevin-zhao": { status: "not_invited", deviceCheck: false, avatarReady: false, admitted: false },
    "rachel-simmons": { status: "declined", deviceCheck: false, avatarReady: false, admitted: false },
  },
  checkpointsCompleted: 4,
  totalCheckpoints: 6,
  savedMoments: [
    { id: "mom-1", personId: "ava-patel", note: "Tool access could be improved on lower bracket.", timestamp: "00:16:45", shared: true },
    { id: "mom-2", personId: "jordan-brooks", note: "Strong example of cross-team coordination at Inspection Point B.", timestamp: "00:24:02", shared: true },
    { id: "mom-3", personId: "leah-morgan", note: "Confusion on documentation sign-off step -- flag for retraining.", timestamp: "00:31:18", shared: true },
  ],
  leadershipContentStatus: {
    "why-future-factory-matters": "released",
    "how-well-work-together": "released",
  },
  feedbackComments: [
    { id: "fb-1", personId: "ava-patel", body: "Need clarity on how this impacts night shift training.", stageIndex: 2, resolved: false, timestamp: "1h ago" },
    { id: "fb-2", personId: "daniel-ruiz", body: "Can we align simulation scenarios with Q4 launch?", stageIndex: 2, resolved: false, timestamp: "3h ago" },
    { id: "fb-3", personId: "leah-morgan", body: "This will help standardize skills across sites.", stageIndex: 2, resolved: true, timestamp: "5h ago" },
  ],
  decisionStageIndex: 2,
};

export { NAMED_EMPLOYEE_IDS };

function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function withInvitationSent(state: WorkforceDemoStoreState, personId: string): WorkforceDemoStoreState {
  return { ...state, invitations: { ...state.invitations, [personId]: { status: "invited", deviceCheck: false, avatarReady: false, admitted: false } } };
}

export function withInvitationResent(state: WorkforceDemoStoreState, personId: string): WorkforceDemoStoreState {
  const existing = state.invitations[personId];
  if (!existing) return withInvitationSent(state, personId);
  return { ...state, invitations: { ...state.invitations, [personId]: { ...existing, status: "invited" } } };
}

export function withInvitationRemoved(state: WorkforceDemoStoreState, personId: string): WorkforceDemoStoreState {
  const next = { ...state.invitations };
  delete next[personId];
  return { ...state, invitations: next };
}

export function withInvitationConfirmed(state: WorkforceDemoStoreState, personId: string): WorkforceDemoStoreState {
  const existing = state.invitations[personId] ?? { status: "invited" as const, deviceCheck: false, avatarReady: false, admitted: false };
  return { ...state, invitations: { ...state.invitations, [personId]: { ...existing, status: "confirmed", deviceCheck: true, avatarReady: true } } };
}

export function withInvitationDeclined(state: WorkforceDemoStoreState, personId: string): WorkforceDemoStoreState {
  const existing = state.invitations[personId] ?? { status: "invited" as const, deviceCheck: false, avatarReady: false, admitted: false };
  return { ...state, invitations: { ...state.invitations, [personId]: { ...existing, status: "declined" } } };
}

export function withParticipantAdmitted(state: WorkforceDemoStoreState, personId: string): WorkforceDemoStoreState {
  const existing = state.invitations[personId];
  if (!existing) return state;
  return { ...state, invitations: { ...state.invitations, [personId]: { ...existing, admitted: true } } };
}

export function withAdmissionToggled(state: WorkforceDemoStoreState): WorkforceDemoStoreState {
  return { ...state, admissionOpen: !state.admissionOpen };
}

export function withMomentSaved(state: WorkforceDemoStoreState, personId: string, note: string): WorkforceDemoStoreState {
  const moment: WorkforceDemoSavedMomentState = { id: nextId("mom"), personId, note, timestamp: new Date().toISOString().slice(11, 19), shared: false };
  return { ...state, savedMoments: [moment, ...state.savedMoments] };
}

export function withMomentShared(state: WorkforceDemoStoreState, momentId: string): WorkforceDemoStoreState {
  return { ...state, savedMoments: state.savedMoments.map((m) => (m.id === momentId ? { ...m, shared: true } : m)) };
}

export function withMomentDeleted(state: WorkforceDemoStoreState, momentId: string): WorkforceDemoStoreState {
  return { ...state, savedMoments: state.savedMoments.filter((m) => m.id !== momentId) };
}

export function withCheckpointCompleted(state: WorkforceDemoStoreState): WorkforceDemoStoreState {
  return { ...state, checkpointsCompleted: Math.min(state.totalCheckpoints, state.checkpointsCompleted + 1) };
}

export function withContentReleased(state: WorkforceDemoStoreState, contentId: string): WorkforceDemoStoreState {
  return { ...state, leadershipContentStatus: { ...state.leadershipContentStatus, [contentId]: "released" } };
}

export function withContentWithdrawn(state: WorkforceDemoStoreState, contentId: string): WorkforceDemoStoreState {
  return { ...state, leadershipContentStatus: { ...state.leadershipContentStatus, [contentId]: "withdrawn" } };
}

export function withProposalDecided(state: WorkforceDemoStoreState, decision: WorkforceDemoProposalStatus): WorkforceDemoStoreState {
  return { ...state, proposalStatus: decision, sessionStatus: decision === "approved" ? "approved" : state.sessionStatus };
}

export function withFeedbackAdded(state: WorkforceDemoStoreState, personId: string, body: string, stageIndex: number): WorkforceDemoStoreState {
  const comment: WorkforceDemoFeedbackCommentState = { id: nextId("fb"), personId, body, stageIndex, resolved: false, timestamp: "just now" };
  return { ...state, feedbackComments: [comment, ...state.feedbackComments] };
}

export function withFeedbackResolved(state: WorkforceDemoStoreState, commentId: string): WorkforceDemoStoreState {
  return { ...state, feedbackComments: state.feedbackComments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c)) };
}

export function withStageAdvanced(state: WorkforceDemoStoreState): WorkforceDemoStoreState {
  return { ...state, decisionStageIndex: Math.min(6, state.decisionStageIndex + 1) };
}

export function withSessionStarted(state: WorkforceDemoStoreState): WorkforceDemoStoreState {
  return { ...state, sessionStatus: "live" };
}

export function withSessionEnded(state: WorkforceDemoStoreState): WorkforceDemoStoreState {
  return { ...state, sessionStatus: "completed" };
}
