import {
  LayoutGrid, ListChecks, UserCheck, Calendar, Compass, Users, ClipboardCheck, GitBranch,
  MessageSquare, LayoutList, UsersRound, FileText, Layers, Video, ClipboardList, Radio,
  Award, Play, Bookmark, HelpCircle, Archive,
} from "lucide-react";
import { WorkforcePreviewRole, WorkforceNavContext } from "./workforcePreviewRole";

// Role-computed navigation, the single shared source of truth for what each of the 6 preview
// roles may see (per the controlling spec sections 1-6). Replaces the old pattern of every page
// hand-writing its own <DemoNavItem> list -- that's what let "Assigned Managers", "Proposals",
// and "Feedback" silently drift into pointing at unrelated reused pages. Consumed by DemoShell,
// which renders ROLE_NAV[role] resolved against the current WorkforceNavContext -- never by
// individual pages.

export type { WorkforceNavContext };

export interface WorkforceNavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  href: (ctx: WorkforceNavContext) => string;
}

const decisionPool: WorkforceNavItem = { key: "decision-pool", label: "Decision Pool", icon: LayoutGrid, href: () => "/workforce/demo" };
const myDecisions: WorkforceNavItem = { key: "my-decisions", label: "My Decisions", icon: ListChecks, href: () => "/workforce/demo/decisions/mine" };
const assignedToMe: WorkforceNavItem = { key: "assigned-to-me", label: "Assigned to Me", icon: UserCheck, href: () => "/workforce/demo/assigned" };
const orgSessions: WorkforceNavItem = { key: "sessions", label: "Sessions", icon: Calendar, href: () => "/workforce/demo/sessions" };
const managerSessions: WorkforceNavItem = { key: "manager-sessions", label: "Sessions", icon: Calendar, href: () => "/workforce/demo/manager/sessions" };
const attractions: WorkforceNavItem = { key: "attractions", label: "Attractions", icon: Compass, href: () => "/workforce/demo/attractions" };
const peopleTeams: WorkforceNavItem = { key: "people-teams", label: "People & Teams", icon: Users, href: () => "/workforce/demo/people" };
const evidenceOutcomes: WorkforceNavItem = { key: "evidence-outcomes", label: "Evidence & Outcomes", icon: ClipboardCheck, href: () => "/workforce/demo/evidence" };
const decisionOverview: WorkforceNavItem = { key: "decision-overview", label: "Decision Overview", icon: LayoutGrid, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/workspace` };
const pathway: WorkforceNavItem = { key: "pathway", label: "Pathway", icon: GitBranch, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/pathway` };
const departmentBreakouts: WorkforceNavItem = { key: "department-breakouts", label: "Department Breakouts", icon: Users, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}` };
const departmentProgress: WorkforceNavItem = { key: "department-progress", label: "Department Progress", icon: Users, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}` };
const feedback: WorkforceNavItem = { key: "feedback", label: "Feedback", icon: MessageSquare, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/feedback` };
const experienceCatalog: WorkforceNavItem = { key: "experience-catalog", label: "Experience Catalog", icon: LayoutList, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}/experiences` };
const assignedManagers: WorkforceNavItem = { key: "assigned-managers", label: "Assigned Managers", icon: UsersRound, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}/managers` };
const departmentProposals: WorkforceNavItem = { key: "proposals", label: "Proposals", icon: FileText, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}/proposals` };
const myAssignments: WorkforceNavItem = { key: "my-assignments", label: "My Assignments", icon: Award, href: () => "/workforce/demo/manager/assignments" };
const sessionProposals: WorkforceNavItem = { key: "session-proposals", label: "Session Proposals", icon: FileText, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}/proposals` };
const sessionOverview: WorkforceNavItem = { key: "session-overview", label: "Session Overview", icon: Layers, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}` };
const managerOnboarding: WorkforceNavItem = { key: "manager-onboarding", label: "Onboarding", icon: Users, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/onboarding` };
const managerParticipants: WorkforceNavItem = { key: "manager-participants", label: "Participants", icon: ListChecks, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/participants` };
const managerAssessments: WorkforceNavItem = { key: "manager-assessments", label: "Assessments", icon: ClipboardCheck, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/assessments` };
const managerPovBreakouts: WorkforceNavItem = { key: "manager-pov-breakouts", label: "POV Breakouts", icon: Video, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/pov-breakouts` };
const managerLeadershipContent: WorkforceNavItem = { key: "manager-leadership-content", label: "Leadership Content", icon: MessageSquare, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/leadership-content` };
const managerAnalytics: WorkforceNavItem = { key: "manager-analytics", label: "Session Analytics", icon: ClipboardCheck, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/analytics` };
const managerArchive: WorkforceNavItem = { key: "manager-archive", label: "Recordings & Archive", icon: Archive, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/archive` };
const sessionAnalyticsReadOnly: WorkforceNavItem = { key: "session-analytics-readonly", label: "Session Analytics", icon: ClipboardList, href: (ctx) => `/workforce/demo/manager/sessions/${ctx.sessionId}/analytics` };
const approverProposals: WorkforceNavItem = { key: "approver-proposals", label: "Proposals", icon: FileText, href: (ctx) => `/workforce/demo/decisions/${ctx.decisionId}/departments/${ctx.departmentId}/proposals` };
const mySession: WorkforceNavItem = { key: "my-session", label: "My Session", icon: Layers, href: (ctx) => `/workforce/demo/my-session/${ctx.sessionId}` };
const world3d: WorkforceNavItem = { key: "world-3d", label: "3D World", icon: Video, href: (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/world` };
const participantsPov: WorkforceNavItem = { key: "participants-pov", label: "Participants & POV", icon: Radio, href: (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/participants-pov` };
const employeeLeadershipContent: WorkforceNavItem = { key: "employee-leadership-content", label: "Leadership Content", icon: Play, href: (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/leadership-content` };
const savedMoments: WorkforceNavItem = { key: "saved-moments", label: "Saved Moments", icon: Bookmark, href: (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/saved-moments` };
const help: WorkforceNavItem = { key: "help", label: "Help", icon: HelpCircle, href: (ctx) => `/workforce/demo/my-session/${ctx.sessionId}/help` };

export const ROLE_NAV: Record<WorkforcePreviewRole, WorkforceNavItem[]> = {
  enterprise_owner: [decisionPool, myDecisions, assignedToMe, orgSessions, attractions, peopleTeams, evidenceOutcomes],
  decision_owner: [myDecisions, assignedToMe, orgSessions, attractions, peopleTeams, evidenceOutcomes, decisionOverview, pathway, departmentBreakouts, feedback],
  department_leader: [assignedToMe, orgSessions, peopleTeams, evidenceOutcomes, decisionOverview, departmentBreakouts, experienceCatalog, assignedManagers, departmentProposals, feedback],
  manager: [assignedToMe, managerSessions, peopleTeams, experienceCatalog, myAssignments, sessionProposals, sessionOverview, managerOnboarding, managerParticipants, managerAssessments, managerPovBreakouts, managerLeadershipContent, managerAnalytics, managerArchive],
  employee: [mySession, world3d, participantsPov, employeeLeadershipContent, savedMoments, help],
  approver: [assignedToMe, orgSessions, approverProposals, evidenceOutcomes, decisionOverview, departmentProgress, sessionAnalyticsReadOnly, feedback],
};
