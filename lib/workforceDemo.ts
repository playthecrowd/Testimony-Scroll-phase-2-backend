// Centralized mock data for the Plotabl Workforce decision-pipeline visual-completion checkpoint.
// Source of truth: the user-supplied handoff package (PLOTABL_WORKFORCE_MODULE_BUILD_SPEC.md,
// plotabl-workforce-mock-data.json, WF-01..WF-10 reference screenshots). This module has zero
// Supabase/database dependency by design -- every /workforce/demo/** page reads only from here, so
// the same person/decision/session data stays identical across every page in the pipeline. This is
// deliberately separate from the real, Supabase-backed /workforce/decisions/** pages built earlier
// (which are untouched) -- D-2048 is not a UUID and was never meant to collide with those routes.

export type WorkforceDemoRole =
  | "platform_owner"
  | "module_owner"
  | "stakeholder"
  | "department_leadership"
  | "manager"
  | "employee"
  | "intern"
  | "vendor";

export interface WorkforceDemoPerson {
  id: string;
  name: string;
  email: string;
  role: WorkforceDemoRole;
  title: string;
  departmentId: string | null;
  portraitUrl: string | null;
}

export const ORGANIZATION = {
  id: "org_apex_aerospace_qa",
  name: "Apex Aerospace Systems — QA",
  slug: "apex-aerospace-qa",
} as const;

export const MODULE = {
  id: "module_plotabl_workforce",
  name: "Plotabl Workforce",
  slug: "workforce",
} as const;

export const DEPARTMENTS = [
  { id: "dept_advanced_manufacturing", name: "Advanced Manufacturing" },
  { id: "dept_operations", name: "Operations" },
  { id: "dept_workforce_development", name: "Workforce Development" },
] as const;

const P = "/workforce/demo/profiles";

export const PEOPLE: WorkforceDemoPerson[] = [
  { id: "platform-owner", name: "Platform Owner QA", email: "plotabl-owner@qa.quest4thekingdom.com", role: "platform_owner", title: "Platform Owner", departmentId: null, portraitUrl: null },
  { id: "enterprise-owner", name: "Enterprise Owner QA", email: "workforce-owner@qa.quest4thekingdom.com", role: "module_owner", title: "Enterprise Owner", departmentId: null, portraitUrl: `${P}/portrait-latina-50s.webp` },
  { id: "maya-chen", name: "Maya Chen", email: "maya.chen@qa.quest4thekingdom.com", role: "stakeholder", title: "Decision Owner, Enterprise Operations Council", departmentId: null, portraitUrl: `${P}/portrait-maya-chen.webp` },
  { id: "maya-patel", name: "Maya Patel", email: "maya.patel@qa.quest4thekingdom.com", role: "department_leadership", title: "VP, Advanced Manufacturing", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-maya-patel.webp` },
  { id: "jordan-brooks", name: "Jordan Brooks", email: "jordan.brooks@qa.quest4thekingdom.com", role: "manager", title: "Operations Manager", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-jordan-brooks.webp` },
  { id: "priya-shah", name: "Priya Shah", email: "priya.shah@qa.quest4thekingdom.com", role: "manager", title: "Manufacturing Manager", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-priya-shah.webp` },
  { id: "daniel-ruiz", name: "Daniel Ruiz", email: "daniel.ruiz@qa.quest4thekingdom.com", role: "manager", title: "Process Engineering Manager", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-daniel-ruiz.webp` },
  { id: "ava-patel", name: "Ava Patel", email: "ava.patel@qa.quest4thekingdom.com", role: "employee", title: "Assembly Supervisor", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-ava-patel.webp` },
  { id: "leah-morgan", name: "Leah Morgan", email: "leah.morgan@qa.quest4thekingdom.com", role: "employee", title: "Training Lead", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-leah-morgan.webp` },
  { id: "marcus-allen", name: "Marcus Allen", email: "marcus.allen@qa.quest4thekingdom.com", role: "employee", title: "Process Engineer", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-marcus-allen.webp` },
  { id: "nia-coleman", name: "Nia Coleman", email: "nia.coleman@qa.quest4thekingdom.com", role: "employee", title: "Manufacturing Supervisor", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-extra1.webp` },
  { id: "kevin-zhao", name: "Kevin Zhao", email: "kevin.zhao@qa.quest4thekingdom.com", role: "employee", title: "Quality Technician", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-extra2.webp` },
  { id: "rachel-simmons", name: "Rachel Simmons", email: "rachel.simmons@qa.quest4thekingdom.com", role: "employee", title: "Production Engineer", departmentId: "dept_advanced_manufacturing", portraitUrl: `${P}/portrait-extra3.webp` },
  { id: "david-chen", name: "David Chen", email: "david.chen@qa.quest4thekingdom.com", role: "module_owner", title: "VP Operations, Approver", departmentId: null, portraitUrl: `${P}/portrait-david-chen.webp` },
  { id: "intern-qa", name: "Intern QA", email: "workforce-intern@qa.quest4thekingdom.com", role: "intern", title: "STEM Intern", departmentId: "dept_advanced_manufacturing", portraitUrl: null },
  { id: "vendor-qa", name: "Vendor QA", email: "workforce-vendor@qa.quest4thekingdom.com", role: "vendor", title: "Immersive Systems Partner", departmentId: null, portraitUrl: null },
];

// The default "invited group" for avatar-cluster displays -- widened to 6 so groups read as
// populated rather than sparse (explicit feedback: 1-2 avatars looked empty).
export const SAMPLE_GROUP_IDS = ["maya-patel", "jordan-brooks", "priya-shah", "daniel-ruiz", "nia-coleman", "kevin-zhao"];

export function findPerson(id: string): WorkforceDemoPerson {
  const person = PEOPLE.find((p) => p.id === id);
  if (!person) throw new Error(`Unknown workforce demo person id: ${id}`);
  return person;
}

export function findDepartment(id: string) {
  const dept = DEPARTMENTS.find((d) => d.id === id);
  if (!dept) throw new Error(`Unknown workforce demo department id: ${id}`);
  return dept;
}

// The seven-stage pathway, per PLOTABL_WORKFORCE_UI_CONTENT_AND_SCREEN_GUIDE.md section "WF-03".
export const PATHWAY_STAGES = [
  "Stakeholder Intent",
  "Leadership Approval",
  "Department Translation",
  "Management Planning",
  "Employee Activation",
  "Implementation",
  "Outcomes & Lessons",
] as const;

export const DECISION = {
  id: "D-2048",
  title: "Future Factory Workforce Readiness",
  status: "department_translation" as const,
  statusLabel: "Department Translation",
  progressPercent: 38,
  currentStageIndex: 2, // "Department Translation", 0-indexed into PATHWAY_STAGES
  priority: "strategic" as const,
  security: "internal" as const,
  controllingStakeholder: "Enterprise Operations Council",
  decisionOwnerId: "maya-chen",
  createdById: "maya-patel",
  departmentId: "dept_advanced_manufacturing",
  departmentLeaderId: "maya-patel",
  targetDate: "2026-10-24",
  executiveIntent: "Prepare departments and workforce teams for a coordinated transition into advanced manufacturing workflows.",
  desiredOutcome: "A skilled, adaptable workforce aligned to advanced manufacturing workflows and technologies.",
  successMeasures: "Training completion, role readiness, productivity uplift, and adoption of advanced workflows.",
  audience: { managers: 7, employees: 86, interns: 12 },
  requiredOutcomes: ["role_readiness", "safe_adoption", "workflow_proficiency"],
  supportingFiles: ["FutureFactory_Readiness_Brief.pdf", "Workforce_Roadmap.xlsx", "Training_Framework.pptx"],
  heroImageUrl: "/workforce/demo/decisions/d-2048-hero.webp",
  thumbnailUrl: "/workforce/demo/decisions/d-2048-thumbnail.webp",
  createdAt: "2026-08-06T14:00:00-04:00",
  lastActivity: "Maya Patel updated Executive Intent and added 1 file.",
};

const D = "/workforce/demo/decisions";

// Other Decisions rail -- from the build spec's "Decision Pool mock cards" list. Each has a real,
// topic-matched thumbnail (no repeated/generic images) but no full detail page in this checkpoint --
// the vertical slice's job is to prove D-2048's pipeline end-to-end, not to flesh out all 32.
export const OTHER_DECISIONS = [
  { id: "D-2047", title: "Digital Thread Adoption", status: "In Translation", owner: "Ethan Clarke", stakeholder: "Technology Steering Committee", progress: "2/5", thumbnailUrl: `${D}/d-2047-thumbnail.webp` },
  { id: "D-2046", title: "Supplier Quality Standard", status: "Stakeholder Review", owner: "Laura Chen", stakeholder: "Quality & Safety Board", progress: "3/6", thumbnailUrl: `${D}/d-2046-thumbnail.webp` },
  { id: "D-2045", title: "Advanced Manufacturing Training", status: "Management Planning", owner: "James Walker", stakeholder: "Workforce Development Office", progress: "2/5", thumbnailUrl: `${D}/d-2045-thumbnail.webp` },
  { id: "D-2044", title: "Safety Procedure Update", status: "Employee Activation", owner: "Aisha Khan", stakeholder: "Quality & Safety Board", progress: "2/4", thumbnailUrl: `${D}/d-2044-thumbnail.webp` },
  { id: "D-2043", title: "Engineering Knowledge Transfer", status: "In Translation", owner: "Robert Lee", stakeholder: "Engineering Council", progress: "1/5", thumbnailUrl: `${D}/d-2043-thumbnail.webp` },
  { id: "D-2041", title: "Leadership Alignment Program", status: "Stakeholder Review", owner: "Daniel Morgan", stakeholder: "Enterprise Operations Council", progress: "3/6", thumbnailUrl: `${D}/d-2041-thumbnail.webp` },
] as const;

export const EXPERIENCE_USE_CASES = [
  { capability: "Real-Time Motion to 3D", title: "Workforce Skills Mirror", focus: "Demonstration", description: "Capture expert motions and turn them into repeatable role training.", durationMin: 60, recommended: false },
  { capability: "Volumetric Environments", title: "Future Factory Leadership Stage", focus: "Vision & Conversation", description: "Deliver the transformation vision inside an interactive spatial briefing.", durationMin: 45, recommended: false },
  { capability: "Interactive Gaming Consoles", title: "Mission Skills Challenge", focus: "Morale & Rewards", description: "Build proficiency through scored, team-based operational scenarios.", durationMin: 75, recommended: false },
  { capability: "360° Immersive Viewer", title: "Factory Process Walkthrough", focus: "Visual Orientation", description: "Explore new workflows, stations, and safety zones before deployment.", durationMin: 45, recommended: false },
  { capability: "Live Capture & Distribution", title: "Expert Knowledge Network", focus: "Knowledge Transfer", description: "Preserve demonstrations, key frames, and expert guidance for every shift.", durationMin: 60, recommended: false },
  { capability: "Content-to-Gameplay", title: "Real Event Decision Lab", focus: "Decision Practice", description: "Turn lessons learned into role-specific judgment and response practice.", durationMin: 60, recommended: false },
  { capability: "Screen Ride & Simulator", title: "Future Factory Readiness Simulator", focus: "Skills Training", description: "Practice new equipment, sequencing, and responses before floor activation.", durationMin: 90, recommended: true },
  { capability: "Multiplayer VR & Shared POV", title: "Mentor Shadow Network", focus: "Collaborative Coaching", description: "Let managers observe, guide, and compare multiple participant viewpoints.", durationMin: 75, recommended: false },
] as const;

// Selected experience for this vertical slice -- combines the final two capabilities per the build
// spec section 9 ("For the manager workflow, combine the final two capabilities into a custom use
// case called Future Factory Collaborative POV Simulator").
export const SELECTED_EXPERIENCE_TITLE = "Future Factory Readiness Simulator";

export const SESSION = {
  id: "FF-042",
  decisionId: "D-2048",
  title: "Future Factory Collaborative POV Simulator",
  status: "scheduled" as const,
  hostId: "jordan-brooks",
  startsAt: "2026-09-18T14:00:00-04:00",
  durationMinutes: 60,
  capacity: 24,
  invited: 24,
  checkedIn: 19,
  avatarsReady: 16,
  hostCoversCredits: true,
  creditPool: 120,
  recording: { master: true, mobileWorld: true, vrPov: true, leadershipStream: true },
  channels: ["mobile_avatar_world", "vr_breakout", "leadership_stream", "assessment"] as const,
  participantIds: ["ava-patel", "leah-morgan", "marcus-allen"],
};

// SP-01..SP-04: Create/Edit Proposal, Proposal Detail/Approval, Participant Selection (folded into
// the create form as a step, per the spec's own "tabbed page state" allowance), Booking
// Confirmation. Status vocabulary matches the controlling spec section 8 exactly.
export const SESSION_PROPOSAL = {
  id: "SP-017",
  decisionId: "D-2048",
  experienceTitle: SELECTED_EXPERIENCE_TITLE,
  requestedById: "jordan-brooks",
  status: "pending_approval" as "draft" | "pending_approval" | "changes_requested" | "resubmitted" | "approved" | "rejected" | "cancelled",
  proposedDate: "2026-09-18",
  proposedTime: "14:00",
  durationMinutes: 60,
  participantIds: ["ava-patel", "leah-morgan", "marcus-allen", "nia-coleman", "kevin-zhao"],
  fundingModel: "host_covers" as const,
  creditsRequired: 120,
  creditsAvailable: 1250,
  approvalSteps: [
    { label: "Manager Proposed", byId: "jordan-brooks", date: "Sep 18", done: true },
    { label: "Department Reviewed", byId: "maya-patel", date: "Sep 18", done: true },
    { label: "Leadership Pending", byId: "david-chen", date: null, done: false },
  ],
};

export interface WorkforceDemoFeedbackItem {
  personId: string;
  body: string;
  tag: "risk" | "clarification" | "support" | null;
  timeAgo: string;
}

export const DECISION_FEEDBACK: WorkforceDemoFeedbackItem[] = [
  { personId: "ava-patel", body: "Need clarity on how this impacts night shift training.", tag: "risk", timeAgo: "1h ago" },
  { personId: "daniel-ruiz", body: "Can we align simulation scenarios with Q4 launch?", tag: "clarification", timeAgo: "3h ago" },
  { personId: "leah-morgan", body: "This will help standardize skills across sites.", tag: "support", timeAgo: "5h ago" },
];

export interface WorkforceDemoParticipantStatus {
  personId: string;
  platform: "mobile" | "vr" | "host";
  state: "live" | "available" | "waiting" | "host";
  location: string;
}

export const LIVE_PARTICIPANTS: WorkforceDemoParticipantStatus[] = [
  { personId: "ava-patel", platform: "vr", state: "live", location: "Workcell 3 — Assembly" },
  { personId: "leah-morgan", platform: "mobile", state: "live", location: "Inspection Point B" },
  { personId: "marcus-allen", platform: "mobile", state: "live", location: "Leadership Stream" },
  { personId: "jordan-brooks", platform: "host", state: "host", location: "Session Host" },
];

// Per-employee session analytics, from WF-07's "Employee Outcomes" table.
export const SESSION_OUTCOMES = [
  { personId: "ava-patel", role: "Operator", attendance: "Attended", completion: 100, assessmentScore: 90, readiness: 85, outcome: "Ready" as const },
  { personId: "leah-morgan", role: "Supervisor", attendance: "Attended", completion: 100, assessmentScore: 88, readiness: 80, outcome: "Ready" as const },
  { personId: "marcus-allen", role: "Engineer", attendance: "Attended", completion: 100, assessmentScore: 78, readiness: 70, outcome: "Follow-up Assigned" as const },
];

export const SESSION_ANALYTICS = {
  invited: 24,
  attended: 22,
  completionRate: 92,
  avgUnderstanding: 84,
  readinessConfidence: 78,
  archivedMoments: 61,
};

export interface WorkforceDemoRecording {
  id: string;
  label: string;
  channel: "master" | "mobileWorld" | "vrPov" | "leadershipStream";
  durationMinutes: number;
  sizeLabel: string;
  capturedAt: string;
}

// One recording per SESSION.recording channel, all true for FF-042 in this checkpoint.
export const SESSION_RECORDINGS: WorkforceDemoRecording[] = [
  { id: "rec-master", label: "Full Session Recording", channel: "master", durationMinutes: 62, sizeLabel: "1.8 GB", capturedAt: "2026-09-18T14:00:00-04:00" },
  { id: "rec-mobile", label: "Mobile Avatar World Capture", channel: "mobileWorld", durationMinutes: 58, sizeLabel: "640 MB", capturedAt: "2026-09-18T14:02:00-04:00" },
  { id: "rec-vr", label: "VR POV — Ava Patel", channel: "vrPov", durationMinutes: 41, sizeLabel: "1.1 GB", capturedAt: "2026-09-18T14:05:00-04:00" },
  { id: "rec-leadership", label: "Leadership Stream", channel: "leadershipStream", durationMinutes: 12, sizeLabel: "210 MB", capturedAt: "2026-09-18T14:00:00-04:00" },
];

export interface WorkforceDemoSavedMoment {
  id: string;
  personId: string;
  note: string;
  timestamp: string;
}

// The same live-notes voice as POV Detail's NOTES array, but reframed as archived/saved moments --
// consistent content, not a duplicated fictional roster.
export const SAVED_MOMENTS: WorkforceDemoSavedMoment[] = [
  { id: "mom-1", personId: "ava-patel", note: "Tool access could be improved on lower bracket.", timestamp: "00:16:45" },
  { id: "mom-2", personId: "jordan-brooks", note: "Strong example of cross-team coordination at Inspection Point B.", timestamp: "00:24:02" },
  { id: "mom-3", personId: "leah-morgan", note: "Confusion on documentation sign-off step -- flag for retraining.", timestamp: "00:31:18" },
];

export interface WorkforceDemoEvidenceItem {
  id: string;
  type: "session_report" | "recording" | "artifact";
  title: string;
  sourceSessionId: string | null;
  addedById: string;
  addedAt: string;
  stageIndex: number;
}

// Evidence attached to D-2048's pathway -- what Session Analytics' "Add to Decision Evidence"
// and Recordings & Archive's "Add to Decision Evidence" actions both point at.
export const DECISION_EVIDENCE: WorkforceDemoEvidenceItem[] = [
  { id: "ev-1", type: "artifact", title: "Workforce Audience Map", sourceSessionId: null, addedById: "maya-patel", addedAt: "2026-09-10T09:00:00-04:00", stageIndex: 2 },
  { id: "ev-2", type: "session_report", title: "FF-042 Session Analytics Report", sourceSessionId: "FF-042", addedById: "jordan-brooks", addedAt: "2026-09-18T15:10:00-04:00", stageIndex: 2 },
  { id: "ev-3", type: "recording", title: "Full Session Recording — FF-042", sourceSessionId: "FF-042", addedById: "jordan-brooks", addedAt: "2026-09-18T15:12:00-04:00", stageIndex: 2 },
];

// WF-12/Phase 7: Vendor Fulfillment. "vendor" is a real WorkforceDemoRole (vendor-qa is on the
// roster) but deliberately not one of the six WorkforcePreviewRole switcher entries -- vendors are
// an external delivery partner, not an internal reviewer role in the controlling spec's switcher
// table. This request is reached via a direct link ("Customize with Plotabl" on Department
// Breakout), not via role-switching, and its content speaks from the request itself rather than a
// switchable identity in the header.
export const FULFILLMENT_STAGES = ["Scoping", "Building", "QA Review", "Delivered"] as const;

export interface WorkforceDemoDeliverable {
  label: string;
  done: boolean;
}

export const FULFILLMENT_REQUEST = {
  id: "VR-104",
  title: "Future Factory Readiness Simulator — Custom Build",
  decisionId: "D-2048",
  experienceTitle: SELECTED_EXPERIENCE_TITLE,
  vendorId: "vendor-qa",
  requestedById: "maya-patel",
  currentStageIndex: 1, // "Building"
  dueDate: "2026-09-12",
  scopeNotes: "Adapt the base Screen Ride & Simulator template to Advanced Manufacturing's floor layout, safety zones, and the six-checkpoint inspection sequence used in FF-042.",
  deliverables: [
    { label: "Scope & requirements sign-off", done: true },
    { label: "3D environment build (factory floor + 2 workcells)", done: true },
    { label: "Inspection checkpoint scripting (6 checkpoints)", done: false },
    { label: "VR + mobile avatar parity pass", done: false },
    { label: "QA review with Department Leadership", done: false },
  ] satisfies WorkforceDemoDeliverable[],
} as const;
