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

// Every page in the demo declares which of these "page types" it is; the switcher uses this plus
// the target role to resolve a destination, matching the controlling spec's context-preservation
// table (section 2). This dataset has exactly one decision (D-2048) and one session (FF-042), so
// "preserve context" collapses to "send this role to its canonical page for that decision/session"
// rather than needing full dynamic ID threading -- documented simplification, not an oversight.
export type WorkforcePageType =
  | "decision-pool"
  | "decision-detail"
  | "decision-workspace"
  | "department-workspace"
  | "proposal-create"
  | "proposal-detail"
  | "booking-confirmation"
  | "session-control"
  | "session-onboarding"
  | "session-participants"
  | "session-pov"
  | "session-analytics"
  | "session-archive"
  | "decision-evidence"
  | "vendor-fulfillment";

const DECISION_POOL = "/workforce/demo";
const DECISION_DETAIL = "/workforce/demo/decisions/D-2048";
const DECISION_WORKSPACE = "/workforce/demo/decisions/D-2048/workspace";
const DEPARTMENT_WORKSPACE = "/workforce/demo/decisions/D-2048/departments/dept_advanced_manufacturing";
const SESSION_CONTROL = "/workforce/demo/sessions/FF-042/control";
const SESSION_ONBOARDING = "/workforce/demo/sessions/FF-042/onboarding";
const SESSION_PARTICIPANTS = "/workforce/demo/sessions/FF-042/participants";
const SESSION_ANALYTICS = "/workforce/demo/sessions/FF-042/analytics";

// Default "home" destination per role, used from most page types -- matches the spec's routing
// table: Enterprise Owner/Decision Owner stay at decision level, Department Leader at department
// level, Manager/Employee/Approver at session level.
const DEFAULT_DESTINATION: Record<WorkforcePreviewRole, string> = {
  enterprise_owner: DECISION_WORKSPACE,
  decision_owner: DECISION_DETAIL,
  department_leader: DEPARTMENT_WORKSPACE,
  manager: SESSION_CONTROL,
  employee: SESSION_ONBOARDING,
  approver: SESSION_ANALYTICS,
};

export function resolveRoleDestination(pageType: WorkforcePageType, role: WorkforcePreviewRole): string {
  // Special cases where the default doesn't match the spec's explicit table.
  if (pageType === "decision-pool" && (role === "enterprise_owner" || role === "decision_owner")) {
    return DECISION_POOL;
  }
  if (pageType === "session-pov" && role === "manager") {
    // Manager stays on the POV they're already watching -- there's no separate "manager POV list"
    // page in this build, so re-resolving to Session Control would lose their place.
    return SESSION_CONTROL;
  }
  if (pageType === "session-participants") {
    if (role === "manager") return SESSION_CONTROL;
    if (role === "employee") return SESSION_PARTICIPANTS;
  }
  if (pageType === "proposal-detail" && (role === "department_leader" || role === "approver" || role === "manager")) {
    // These three roles are exactly the ones with a reason to be reviewing this proposal --
    // switching between them should keep the reviewer on the same proposal, not bounce them away.
    return "/workforce/demo/proposals/SP-017";
  }
  return DEFAULT_DESTINATION[role];
}
