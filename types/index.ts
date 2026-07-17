// Central type definitions for Quest for the Kingdom
// Phase Two will map these directly onto Supabase tables.

export type AccountType = "host" | "member";

export interface User {
  id: string;
  fullName: string;
  email: string;
  accountType: AccountType;
  avatarUrl: string;
  churchId?: string; // primary church for members, managed church for hosts
  createdAt: string;
}

export interface Church {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  city: string;
  state: string;
  memberCount: number;
  description: string;
  verified: boolean;
  hostIds: string[];
}

export interface Host {
  id: string;
  churchId: string;
  churchName: string;
  logoUrl: string;
  facilitatorName: string;
  facilitatorAvatarUrl: string;
  joinedCount: number;
  status: "live" | "scheduled";
}

export interface Speaker {
  id: string;
  name: string;
  avatarUrl: string;
  churchId: string;
  bio?: string;
}

export type ContentType = "video" | "audio" | "notes" | "slides" | "multiple";
export type LessonType = "sermon" | "bible-study" | "youth" | "devotional" | "series";

export interface LessonHostSession {
  hostId: string;
  status: "live" | "scheduled";
  participantCount: number;
  scheduleLabel?: string;
  questUrl?: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  aboutText: string;
  topic: string;
  subject: string;
  ministryCategory: string;
  churchId: string;
  speakerId: string;
  date: string;
  durationLabel: string;
  contentTypes: ContentType[];
  lessonType: LessonType;
  primaryScripture: string;
  supportingScriptures: string[];
  tags: string[];
  featuredImageUrl: string;
  notesUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  slidesUrl?: string;
  pastedNotes?: string;
  questUrl?: string;
  questLevel?: number;
  xpReward?: number;
  hostSessions: LessonHostSession[];
  contributorsCount: number;
  createdBySubmission?: boolean;
  isNew?: boolean;
}

export interface StudyQuestion {
  id: string;
  lessonId: string;
  question: string;
}

export type JourneyStage =
  | "not-started"
  | "captured"
  | "studied"
  | "experienced"
  | "applied"
  | "added-to-story";

export interface JourneyChecklist {
  notesStudied: boolean;
  videoWatched: boolean;
  audioListened: boolean;
  slidesViewed: boolean;
  questionsAnswered: boolean;
}

export interface Journey {
  id: string;
  userId: string;
  lessonId: string;
  stage: JourneyStage;
  progressPercent: number;
  startedAt: string;
  studiedAt?: string;
  experiencedAt?: string;
  appliedAt?: string;
  addedToStoryAt?: string;
  checklist: JourneyChecklist;
  questResultId?: string;
  testimonyId?: string;
}

export interface QuestResult {
  id: string;
  userId: string;
  lessonId: string;
  hostId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  objectsCollected: number;
  objectsTotal: number;
  completionTime: string;
  rank?: number;
  completedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  churchName: string;
  score: number;
  time: string;
  date: string;
  lessonId: string;
}

export type TestimonyVisibility = "public" | "church-only" | "private";
export type TestimonyIdentity = "full-name" | "first-name" | "username" | "anonymous";
export type TestimonyStatus = "awaiting-review" | "approved" | "rejected";

export interface Testimony {
  id: string;
  userId: string;
  primaryLessonId: string;
  supportingLessonIds: string[];
  whatLearned: string;
  howApplied: string;
  situation: string;
  actionTaken: string;
  howHelpsOthers: string;
  writtenTestimony: string;
  applicationScenario?: string;
  videoUrlPlaceholder?: string;
  audioUrlPlaceholder?: string;
  transcript?: string;
  visibility: TestimonyVisibility;
  identityDisplay: TestimonyIdentity;
  storyGenerationPermission: boolean;
  futureEpisodePermission: boolean;
  voiceLikenessPermission: boolean;
  status: TestimonyStatus;
  title: string;
  topic: string;
  scripture: string;
  thumbnailUrl: string;
  submittedAt: string;
  approvedAt?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  durationLabel: string;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  quote: string;
  quoteSource: string;
  storyArc: string;
  arcLabel: string;
  isKeyCharacter: boolean;
  testimonyId?: string;
}

export interface StoryEntry {
  id: string;
  episodeNumber: number;
  date: string;
  title: string;
  storyText: string;
  characterId: string;
  topic: string;
  scripture: string;
  arcLabel: string;
  contributorIds: string[];
  testimonyId: string;
  lessonIds: string[];
  imageUrl: string;
}

export interface Episode {
  id: string;
  season: number;
  episodeNumber: number;
  title: string;
  description: string;
  durationLabel: string;
  topic: string;
  scripture: string;
  mainCharacterId: string;
  mainCharacterRole: string;
  storyArc: string;
  contributorIds: string[];
  releaseDate: string;
  thumbnailUrl: string;
  quote?: string;
  quoteSource?: string;
  featured?: boolean;
  upcoming?: boolean;
}

export type BadgeStage =
  | "captured"
  | "studied"
  | "experienced"
  | "applied"
  | "added-to-story"
  | "full-journey";

export interface Badge {
  id: string;
  stage: BadgeStage;
  name: string;
  description: string;
  icon: string;
  color: "blue" | "purple" | "gold";
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  lessonId?: string;
  earnedAt: string;
}

export type NotificationType =
  | "testimony-invitation"
  | "badge-earned"
  | "review-approved"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}

// ---------------------------------------------------------------------------
// Backend Milestone One: Supabase-backed types, additive only. These describe data coming
// from the real database (Capture, Lessons Library, Lesson Detail, Church Archive) and are
// kept separate from the mock types above so every mock-powered page keeps compiling as-is.
// ---------------------------------------------------------------------------

export type LessonMediaType = "notes" | "video" | "audio" | "slides" | "document" | "transcript";

export interface LessonMedia {
  id: string;
  mediaType: LessonMediaType;
  url: string | null;
  content: string | null;
  title: string | null;
}

export interface Ministry {
  id: string;
  name: string;
}

export interface PublishedChurch {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  memberCount: number;
  description: string | null;
  verified: boolean;
  addressLine1: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  churchType: string | null;
  bannerUrl: string | null;
}

export interface ChurchMinistry {
  id: string;
  name: string;
}

export interface ChurchMember {
  membershipId: string;
  profileId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: "member" | "host" | "admin";
  joinedAt: string;
}

export interface ChurchInvite {
  id: string;
  churchId: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  acceptedAt: string | null;
}

export interface PublishedSpeaker {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface PublishedLessonHost {
  id: string;
  status: "live" | "scheduled";
  participantCount: number;
  scheduleLabel: string | null;
  questUrl: string | null;
  church: PublishedChurch | null;
}

export interface PublishedLesson {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  aboutText: string | null;
  topic: string | null;
  subject: string | null;
  ministryCategory: string | null;
  date: string | null;
  durationLabel: string | null;
  lessonType: string | null;
  primaryScripture: string | null;
  supportingScriptures: string[];
  tags: string[];
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  questUrl: string | null;
  questLevel: number | null;
  xpReward: number | null;
  status: "draft" | "published";
  contributorsCount: number;
  createdAt: string;
  updatedAt: string;
  church: PublishedChurch;
  speaker: PublishedSpeaker | null;
  media: LessonMedia[];
  hosts: PublishedLessonHost[];
  ministries: Ministry[];
  questions: LessonQuestion[];
  experiences: LessonExperienceLink[];
}

export interface LessonQuestion {
  id: string;
  question: string;
  sortOrder: number;
}

export interface Experience {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
}

export interface LessonExperienceLink {
  id: string;
  relationshipNote: string | null;
  experience: Experience;
}

// Supabase-backed member journey progress (public.lesson_journeys / public.lesson_journey_items,
// migration 0008). Separate from the mock Journey/JourneyChecklist types above, which the
// still-mocked Experienced/Applied/Added-to-Story stages continue to use.
export interface LessonJourney {
  id: string;
  lessonId: string;
  currentStage: "captured" | "studied" | "experienced" | "applied" | "added-to-story";
  studiedStartedAt: string;
  studiedCompletedAt: string | null;
  lastOpenedAt: string;
}

export interface LessonJourneyItem {
  id: string;
  itemKey: string;
  completed: boolean;
  completedAt: string | null;
}

// Phase 5 (docs/PHASE5_AUDIT.md): public.lesson_requests.
export type LessonRequestScope = "church" | "public";
export type LessonRequestStatus = "submitted" | "under_review" | "approved" | "declined" | "fulfilled";

export interface LessonRequest {
  id: string;
  topic: string;
  notes: string | null;
  scope: LessonRequestScope;
  churchId: string | null;
  churchName: string | null;
  status: LessonRequestStatus;
  createdAt: string;
  updatedAt: string;
}
