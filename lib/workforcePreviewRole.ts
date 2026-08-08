// The six review/QA "preview roles" from the controlling spec (section 2), distinct from
// WorkforceDemoRole in workforceDemo.ts (which describes each mock person's actual job function,
// e.g. Daniel Ruiz's role is "manager" regardless of which preview role a reviewer is currently
// wearing). This is a prototype review feature only -- it does not replace real authorization.

export type WorkforcePreviewRole =
  | "enterprise_owner"
  | "decision_owner"
  | "department_leader"
  | "manager"
  | "employee"
  | "approver";

export const PREVIEW_ROLES: WorkforcePreviewRole[] = [
  "enterprise_owner",
  "decision_owner",
  "department_leader",
  "manager",
  "employee",
  "approver",
];

export const PREVIEW_ROLE_LABEL: Record<WorkforcePreviewRole, string> = {
  enterprise_owner: "Enterprise Owner",
  decision_owner: "Decision Owner",
  department_leader: "Department Leader",
  manager: "Manager",
  employee: "Employee",
  approver: "Approver / Executive",
};

// The one representative named person shown for each preview role -- kept in workforceDemo.ts
// alongside the rest of the roster and imported here to avoid a circular module dependency.
export const PREVIEW_ROLE_PERSON: Record<WorkforcePreviewRole, string> = {
  enterprise_owner: "enterprise-owner",
  decision_owner: "maya-chen",
  department_leader: "maya-patel",
  manager: "jordan-brooks",
  employee: "ava-patel",
  approver: "david-chen",
};

// Shared context (which decision/department/session is "current") threaded through both the nav
// config (lib/workforceNav.ts) and the role-switch resolver below. This dataset has exactly one
// decision, one department, and one session, so "preserve context" collapses to "send this role
// to its canonical page for that decision/department/session" -- a documented simplification, not
// an oversight, matching the same simplification already used throughout lib/workforceDemo.ts.
export interface WorkforceNavContext {
  decisionId: string;
  departmentId: string;
  sessionId: string;
}

export const DEFAULT_NAV_CONTEXT: WorkforceNavContext = {
  decisionId: "D-2048",
  departmentId: "dept_advanced_manufacturing",
  sessionId: "FF-042",
};

// Every page in the demo declares which of these "page types" it is; the switcher uses this plus
// the target role to resolve a destination, matching the controlling spec's context-preservation
// table (section 9) and the more detailed per-page requirements doc's explicit role-switch pairs
// (Manager Onboarding <-> Employee My Session, Manager Participants <-> Employee Participants &
// POV, Employee 3D World -> Department Leader read-only Session Overview/Analytics, Department
// Proposals -> Approver same-proposal approval view).
export type WorkforcePageType =
  | "decision-pool"
  | "decision-detail"
  | "decision-workspace"
  | "decision-pathway"
  | "decision-feedback"
  | "decision-mine"
  | "department-breakout"
  | "department-experiences"
  | "department-managers"
  | "department-proposals"
  | "proposal-create"
  | "proposal-detail"
  | "booking-confirmation"
  | "assigned-to-me"
  | "org-sessions"
  | "attractions"
  | "people"
  | "evidence"
  | "manager-all-sessions"
  | "manager-assignments"
  | "manager-session-overview"
  | "manager-onboarding"
  | "manager-participants"
  | "manager-assessments"
  | "manager-pov-breakouts"
  | "manager-leadership-content"
  | "manager-analytics"
  | "manager-archive"
  | "my-session"
  | "my-session-world"
  | "my-session-participants-pov"
  | "my-session-pov"
  | "my-session-leadership-content"
  | "my-session-saved-moments"
  | "my-session-help"
  | "vendor-fulfillment";

type PathFn = (ctx: WorkforceNavContext) => string;

const decisionPoolPath: PathFn = () => "/workforce/demo";
const decisionWorkspacePath: PathFn = (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/workspace`;
const decisionDetailPath: PathFn = (ctx) => `/workforce/demo/decisions/${ctx.decisionId}`;
const departmentBreakoutPath: PathFn = (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}`;
const decisionMinePath: PathFn = () => "/workforce/demo/decisions/mine";
const assignedToMePath: PathFn = () => "/workforce/demo/assigned";
const orgSessionsPath: PathFn = () => "/workforce/demo/sessions";
const attractionsPath: PathFn = () => "/workforce/demo/attractions";
const peoplePath: PathFn = () => "/workforce/demo/people";
const evidencePath: PathFn = () => "/workforce/demo/evidence";
const proposalDetailPath: PathFn = () => "/workforce/demo/proposals/SP-017";
const managerSessionOverviewPath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}`;
const managerOnboardingPath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/onboarding`;
const managerParticipantsPath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/participants`;
const managerPovBreakoutsPath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/pov-breakouts`;
const managerLeadershipPath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/leadership-content`;
const managerAnalyticsPath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/analytics`;
const managerArchivePath: PathFn = (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/archive`;
const mySessionPath: PathFn = (ctx) => `/workforce/demo/my-session/${ctx.sessionId}`;
const myWorldPath: PathFn = (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/world`;
const myParticipantsPovPath: PathFn = (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/participants-pov`;
const myLeadershipPath: PathFn = (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/leadership-content`;
const mySavedMomentsPath: PathFn = (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/saved-moments`;

// Default "home" destination per role -- the generic fallback used whenever a page type has no
// more specific role-view entry below.
const ROLE_HOME: Record<WorkforcePreviewRole, PathFn> = {
  enterprise_owner: decisionWorkspacePath,
  decision_owner: decisionDetailPath,
  department_leader: departmentBreakoutPath,
  manager: managerSessionOverviewPath,
  employee: mySessionPath,
  approver: managerAnalyticsPath,
};

type RoleViewMap = Partial<Record<WorkforcePreviewRole, PathFn>>;

// Leadership roles (Enterprise Owner, Decision Owner, Department Leader) land on the Manager's
// Session Overview page in read-only mode when leaving a session-scoped page -- these pages
// themselves gate their interactive controls off `role === "manager"` (see the read-only pattern
// already proven on SP-017's canDecide). Approver specifically lands on Analytics per the spec's
// own example pairing.
const leadershipReadOnlySessionOverview: RoleViewMap = {
  enterprise_owner: managerSessionOverviewPath,
  decision_owner: managerSessionOverviewPath,
  department_leader: managerSessionOverviewPath,
  approver: managerAnalyticsPath,
};

const leadershipReadOnlyAnalytics: RoleViewMap = {
  enterprise_owner: managerAnalyticsPath,
  decision_owner: managerAnalyticsPath,
  department_leader: managerAnalyticsPath,
  approver: managerAnalyticsPath,
};

const PAGE_ROLE_VIEWS: Partial<Record<WorkforcePageType, RoleViewMap>> = {
  "decision-pool": { enterprise_owner: decisionPoolPath, decision_owner: decisionPoolPath },
  "decision-mine": { enterprise_owner: decisionMinePath, decision_owner: decisionMinePath },
  "assigned-to-me": { enterprise_owner: assignedToMePath, decision_owner: assignedToMePath, department_leader: assignedToMePath, manager: assignedToMePath, approver: assignedToMePath },
  "org-sessions": { enterprise_owner: orgSessionsPath, decision_owner: orgSessionsPath, department_leader: orgSessionsPath, approver: orgSessionsPath },
  attractions: { enterprise_owner: attractionsPath, decision_owner: attractionsPath, department_leader: attractionsPath, manager: attractionsPath },
  people: { enterprise_owner: peoplePath, decision_owner: peoplePath, department_leader: peoplePath, manager: peoplePath },
  evidence: { enterprise_owner: evidencePath, decision_owner: evidencePath, department_leader: evidencePath, approver: evidencePath },
  "manager-all-sessions": { enterprise_owner: orgSessionsPath, decision_owner: orgSessionsPath, department_leader: orgSessionsPath, approver: orgSessionsPath, employee: mySessionPath },
  "manager-assignments": { enterprise_owner: assignedToMePath, decision_owner: assignedToMePath, department_leader: assignedToMePath, approver: assignedToMePath, employee: mySessionPath },
  "department-proposals": { approver: proposalDetailPath, department_leader: proposalDetailPath, manager: proposalDetailPath },
  "proposal-detail": { department_leader: proposalDetailPath, approver: proposalDetailPath, manager: proposalDetailPath },

  // Manager session-admin pages -> Employee's nearest equivalent (exact pairs from the spec),
  // leadership roles -> read-only Session Overview/Analytics.
  "manager-session-overview": { ...leadershipReadOnlySessionOverview, employee: mySessionPath },
  "manager-onboarding": { ...leadershipReadOnlySessionOverview, employee: mySessionPath },
  "manager-participants": { ...leadershipReadOnlySessionOverview, employee: myParticipantsPovPath },
  "manager-assessments": { ...leadershipReadOnlyAnalytics, employee: myWorldPath },
  "manager-pov-breakouts": { ...leadershipReadOnlyAnalytics, employee: myParticipantsPovPath },
  "manager-leadership-content": { ...leadershipReadOnlySessionOverview, employee: myLeadershipPath },
  "manager-analytics": { ...leadershipReadOnlyAnalytics, employee: mySessionPath },
  "manager-archive": { ...leadershipReadOnlyAnalytics, employee: mySavedMomentsPath },

  // Employee session pages -> Manager's nearest equivalent (exact reverse pairs), leadership -> read-only.
  "my-session": { manager: managerOnboardingPath, ...leadershipReadOnlySessionOverview },
  "my-session-world": { manager: managerSessionOverviewPath, ...leadershipReadOnlyAnalytics },
  "my-session-participants-pov": { manager: managerParticipantsPath, ...leadershipReadOnlySessionOverview },
  "my-session-pov": { manager: managerPovBreakoutsPath, ...leadershipReadOnlyAnalytics },
  "my-session-leadership-content": { manager: managerLeadershipPath, ...leadershipReadOnlySessionOverview },
  "my-session-saved-moments": { manager: managerArchivePath, ...leadershipReadOnlyAnalytics },
  "my-session-help": { manager: managerSessionOverviewPath, ...leadershipReadOnlySessionOverview },
};

export function resolveRoleDestination(pageType: WorkforcePageType, role: WorkforcePreviewRole, ctx: WorkforceNavContext = DEFAULT_NAV_CONTEXT): string {
  const view = PAGE_ROLE_VIEWS[pageType]?.[role];
  if (view) return view(ctx);
  return ROLE_HOME[role](ctx);
}
