// Central type definitions for Quest for the Kingdom
// Phase Two will map these directly onto Supabase tables.

export type AccountType = "host" | "member" | "organization";

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
  // "church" or "organization" -- see supabase/migrations/0041_organization_entity_type.sql.
  // Defaults to "church" only via the DB column default; every row selected here always has an
  // explicit value, this optional marker exists solely because a handful of older mock/demo
  // objects constructed by hand (data/churches.ts, tests) predate this field.
  entityType?: "church" | "organization";
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
  // Large lesson-detail-page background/hero image, distinct from featuredImageUrl (the card/
  // list/homepage thumbnail). Null for the vast majority of existing lessons -- the detail page
  // falls back to featuredImageUrl, then to the current dark background, when unset.
  backgroundImageUrl: string | null;
  questUrl: string | null;
  questLevel: number | null;
  xpReward: number | null;
  status: "draft" | "published";
  contributorsCount: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  // A campaign lesson (isCampaignLesson: true) has no owning church -- church is null for those
  // rows. Every non-campaign lesson still has a real church, same as before.
  church: PublishedChurch | null;
  speaker: PublishedSpeaker | null;
  media: LessonMedia[];
  hosts: PublishedLessonHost[];
  ministries: Ministry[];
  questions: LessonQuestion[];
  experiences: LessonExperienceLink[];
  isCampaignLesson: boolean;
  campaignName: string | null;
  campaignSprintSeason: string | null;
  campaignMonth: string | null;
  campaignMonthNumber: number | null;
  campaignWeekNumber: number | null;
  campaignMonthlyTheme: string | null;
  campaignMonthlyVerse: string | null;
  campaignWeeklyVerse: string | null;
  campaignSpeakerName: string | null;
  campaignSpeakerBio: string | null;
  campaignSpeakerImageUrl: string | null;
  isHighlighted: boolean;
  sortOrder: number;
  displayStartDate: string | null;
  linkedExperienceId: string | null;
}

export interface QuestionChoice {
  id: string;
  answerText: string;
  sortOrder: number;
  isCorrect: boolean;
}

export interface LessonQuestion {
  id: string;
  question: string;
  sortOrder: number;
  // Empty for legacy plain-text-only questions authored before this field existed -- always a
  // safe, renderable shape, never null.
  choices: QuestionChoice[];
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
  // Server-computed, immutable full-lesson-completion timestamp (migration 0042) -- distinct from
  // currentStage/studiedCompletedAt. Null until Study is complete AND every required-linked
  // Experience (if any) is satisfied; a lesson with no required Experience gets this set the
  // moment Study completes. Never cleared once set.
  completedAt: string | null;
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

// Phase 6 (docs/PHASE6_AUDIT.md): public.testimonies. "Published" here follows the same
// convention as PublishedLesson -- it represents any real row (pending/approved/rejected), not
// only ones actually visible on the public Kingdom Scroll.
// "PublishedTestimonyVisibility" (not just "TestimonyVisibility") specifically to avoid colliding
// with the mock TestimonyVisibility type defined earlier in this file -- the mock type uses
// hyphenated values ("church-only"), the real schema uses underscores ("church_only"); these are
// genuinely different types, not a naming accident. TestimonyIdentityDisplay/ChurchStatus/
// PlatformStatus don't collide with anything in the mock section, so they keep short names.
export type PublishedTestimonyVisibility = "public" | "church_only" | "private";
export type TestimonyIdentityDisplay = "full_name" | "first_name" | "username" | "anonymous";
export type TestimonyChurchStatus = "pending" | "approved" | "rejected";
export type TestimonyPlatformStatus = "not_submitted" | "pending" | "approved" | "rejected";

export interface PublishedTestimony {
  id: string;
  churchId: string;
  churchName: string | null;
  primaryLessonId: string;
  primaryLessonTitle: string | null;
  primaryLessonSlug: string | null;
  supportingLessonIds: string[];
  title: string;
  topic: string | null;
  scripture: string | null;
  writtenTestimony: string;
  videoUrl: string | null;
  audioUrl: string | null;
  visibility: PublishedTestimonyVisibility;
  identityDisplay: TestimonyIdentityDisplay;
  displayName: string | null;
  suggestedCharacter: string | null;
  storyGenerationPermission: boolean;
  futureEpisodePermission: boolean;
  voiceLikenessPermission: boolean;
  churchStatus: TestimonyChurchStatus;
  platformStatus: TestimonyPlatformStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

// Phase 7 (docs/PHASE7_AUDIT.md): public.characters / public.episodes. "Published" prefix for
// consistency with PublishedLesson/PublishedChurch/PublishedTestimony -- PublishedEpisode also
// specifically avoids colliding with the mock Episode type defined earlier in this file.
export interface PublishedCharacter {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  imageUrl: string | null;
  quote: string | null;
  quoteSource: string | null;
  isKeyCharacter: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterRelatedEpisode {
  id: string;
  title: string;
  episodeNumber: number;
  season: number;
}

export interface CharacterRelatedTestimony {
  id: string;
  title: string;
  note: string | null;
}

// Derived transitively through the character's own episodes (episode_characters ->
// episode_lessons -> lessons) -- there is no direct character_lessons table. A character with no
// episodes yet simply has an empty array; see services/supabase/characters.ts's own comment for
// why this reuses episode_lessons instead of adding a new, largely-duplicate join table.
export interface CharacterRelatedLesson {
  id: string;
  title: string;
  slug: string;
}

export interface PublishedCharacterWithRelations extends PublishedCharacter {
  episodes: CharacterRelatedEpisode[];
  testimonies: CharacterRelatedTestimony[];
  relatedLessons: CharacterRelatedLesson[];
}

export type PublishedEpisodeStatus = "draft" | "published";

export interface EpisodeCharacterLink {
  id: string;
  name: string;
  imageUrl: string | null;
  roleNote: string | null;
}

export interface EpisodeLessonLink {
  id: string;
  title: string;
  slug: string;
}

export interface PublishedEpisode {
  id: string;
  season: number;
  episodeNumber: number;
  title: string;
  description: string | null;
  durationLabel: string | null;
  topic: string | null;
  scripture: string | null;
  thumbnailUrl: string | null;
  quote: string | null;
  quoteSource: string | null;
  status: PublishedEpisodeStatus;
  featured: boolean;
  releaseDate: string | null;
  createdAt: string;
  updatedAt: string;
  characters: EpisodeCharacterLink[];
  lessons: EpisodeLessonLink[];
}

// Phase 8 (docs/PHASE8_AUDIT.md): public.events. Real Square payment is deliberately not
// modeled beyond an honest placeholder -- paymentStatus can only ever be "not_applicable" or
// "pending", never "paid" (no code path exists that could ever set that, since no Square
// integration exists in this environment).
export type EventCategory = "pop_up_virtual" | "pop_up_physical" | "ticketed" | "game_day" | "church_hosted" | "kingdom_scroll";
export type EventFormat = "virtual" | "physical";
export type EventPaymentStatus = "not_applicable" | "pending";
export type EventStatus = "submitted" | "under_review" | "approved" | "published" | "declined";

export interface PublishedEvent {
  id: string;
  churchId: string | null;
  churchName: string | null;
  title: string;
  description: string | null;
  category: EventCategory;
  format: EventFormat;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  requestingOrg: string | null;
  contactName: string | null;
  contactEmail: string | null;
  expectedAttendance: number | null;
  requestedExperience: string | null;
  equipmentNotes: string | null;
  notes: string | null;
  requiresPayment: boolean;
  priceCents: number | null;
  paymentStatus: EventPaymentStatus;
  status: EventStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 10.1 (docs/PHASE10_EXPERIENCE_PLATFORM_SPEC.md, migration 0022_church_experiences.sql) --
// the church Experience Platform: a reusable activity definition, its scheduled occurrences,
// lesson links, and member registrations. Every type here is prefixed "ChurchExperience" -- never
// the bare "Experience" -- because that name is already taken by the unrelated experiences catalog
// type above (public.experiences, migration 0015). Do not use the bare name for anything new here.
// No service/query layer exists yet for these types (that's Phase 10.2); this is schema-only.
// ---------------------------------------------------------------------------

export type ChurchExperienceType =
  | "volunteer"
  | "outreach"
  | "prayer_gathering"
  | "worship_gathering"
  | "small_group"
  | "bible_study"
  | "service_project"
  | "community_event"
  | "online_gathering"
  | "custom";

export type ChurchExperienceFormat = "in_person" | "online" | "hybrid" | "self_guided";
export type ChurchExperienceStatus = "draft" | "published" | "archived";
export type ChurchExperienceVisibility = "church_only" | "invited_only" | "public";
export type ChurchExperienceCompletionMethod = "host_marked" | "self_attested";

export interface ChurchExperience {
  id: string;
  churchId: string;
  ministryId: string | null;
  createdBy: string | null;
  title: string;
  summary: string | null;
  fullDescription: string | null;
  type: ChurchExperienceType;
  customTypeLabel: string | null;
  format: ChurchExperienceFormat;
  locationName: string | null;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  onlineUrl: string | null;
  coverImageUrl: string | null;
  ageGuidance: string | null;
  accessibilityNotes: string | null;
  preparationInstructions: string | null;
  whatToBring: string | null;
  status: ChurchExperienceStatus;
  visibility: ChurchExperienceVisibility;
  registrationRequired: boolean;
  approvalRequired: boolean;
  defaultCapacity: number | null;
  defaultDurationMinutes: number | null;
  completionMethod: ChurchExperienceCompletionMethod;
  defaultCreditCost: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export type ChurchExperienceOccurrenceStatus = "scheduled" | "cancelled" | "completed";

export interface ChurchExperienceOccurrence {
  id: string;
  experienceId: string;
  churchId: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  capacity: number | null;
  locationName: string | null;
  onlineUrl: string | null;
  hostContactName: string | null;
  hostContactEmail: string | null;
  status: ChurchExperienceOccurrenceStatus;
  cancellationReason: string | null;
  checkInEnabled: boolean;
  attendanceFinalizedAt: string | null;
  creditCost: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ChurchExperienceLessonRelationship = "required" | "recommended";

export interface ChurchExperienceLessonLink {
  id: string;
  experienceId: string;
  lessonId: string;
  relationship: ChurchExperienceLessonRelationship;
  sortOrder: number;
  hostNotes: string | null;
  reflectionPromptOverride: string | null;
  createdAt: string;
}

export type ChurchExperienceRegistrationStatus = "pending" | "confirmed" | "waitlisted" | "cancelled" | "rejected";
export type ChurchExperienceRegistrationSource = "self" | "host_walk_in";
export type ChurchExperienceAttendanceStatus = "not_recorded" | "attended" | "absent" | "excused";
export type ChurchExperienceCompletionStatus = "not_started" | "completed";

export interface ChurchExperienceRegistration {
  id: string;
  occurrenceId: string;
  profileId: string;
  status: ChurchExperienceRegistrationStatus;
  registrationSource: ChurchExperienceRegistrationSource;
  capacityOverride: boolean;
  waitlistPosition: number | null;
  attendanceStatus: ChurchExperienceAttendanceStatus;
  completionStatus: ChurchExperienceCompletionStatus;
  notes: string | null;
  cancellationReason: string | null;
  registeredAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Phase 11.1 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md, docs/PHASE11_1_AUDIT.md) -- Kingdom
// Economy wallet/ledger types, mapped from migrations 0027/0028. Deliberately named
// MemberWallet/ChurchWallet/CreditLedgerEntry (not "Wallet"/"LedgerEntry") to avoid any collision
// with this file's pre-existing mock Badge/UserBadge/Journey interfaces from the Phase-1
// prototype layer (see docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS2d.2).

export interface MemberWallet {
  id: string;
  profileId: string;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchWallet {
  id: string;
  churchId: string;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type CreditTransactionType =
  | "platform_grant"
  | "church_grant"
  | "member_request_approved"
  | "purchase"
  | "experience_spend"
  | "event_spend"
  | "refund"
  | "promotional_credit"
  | "administrator_adjustment"
  | "reversal";

export type CreditLedgerEntryStatus = "pending" | "completed" | "failed" | "reversed";

export interface CreditLedgerEntry {
  id: string;
  memberWalletId: string | null;
  churchWalletId: string | null;
  amount: number;
  transactionType: CreditTransactionType;
  status: CreditLedgerEntryStatus;
  idempotencyKey: string | null;
  relatedChurchId: string | null;
  relatedMemberId: string | null;
  relatedExperienceId: string | null;
  relatedOccurrenceId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  reversesEntryId: string | null;
  reversedByEntryId: string | null;
}

// Phase 11.2 (docs/PHASE11_2_AUDIT.md) -- the member-to-church credit request workflow, mapped
// from migration 0029.
export type CreditRequestStatus = "submitted" | "under_review" | "approved" | "declined" | "cancelled" | "fulfilled";

export interface CreditRequest {
  id: string;
  requestedBy: string;
  churchId: string;
  requestedAmount: number;
  relatedExperienceId: string | null;
  reason: string | null;
  status: CreditRequestStatus;
  declineReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Phase 11.3 (docs/PHASE11_3_AUDIT.md) -- Points/XP/Levels/Badges/Trophies, mapped from
// migrations 0032/0033. ProgressionEventType is a fixed, server-side-only enum -- never an open
// rule engine (spec SS11/SS12).
export type ProgressionEventType =
  | "lesson_studied"
  | "experience_completed"
  | "testimony_submitted"
  | "testimony_church_approved"
  | "testimony_kingdom_scroll_published";

export interface ProgressionAwardRule {
  id: string;
  eventType: ProgressionEventType;
  pointsAmount: number;
  xpAmount: number;
  xpRewardCeiling: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressionLevelThreshold {
  id: string;
  level: number;
  minXp: number;
  createdAt: string;
}

export interface MemberProgressionSummary {
  id: string;
  profileId: string;
  pointsTotal: number;
  xpTotal: number;
  currentLevel: number;
  leaderboardOptOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BadgeCategory = "achievement" | "trophy";
export type BadgeRequirementType = "event_count" | "single_event" | "threshold";

export interface BadgeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: BadgeCategory;
  requirementType: BadgeRequirementType;
  relatedEventType: string | null;
  threshold: number | null;
  isActive: boolean;
  isHiddenUntilEarned: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberBadgeAward {
  id: string;
  memberId: string;
  badgeId: string;
  awardSource: string;
  relatedLessonId: string | null;
  relatedExperienceId: string | null;
  relatedTestimonyId: string | null;
  awardedAt: string;
  awardedBy: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export type LeaderboardScope = "global" | "my_church";

// Named ProgressionLeaderboardEntry, not LeaderboardEntry -- this file already has a
// pre-Supabase mock LeaderboardEntry (services/questService.ts's quest-score shape); this is the
// real, Supabase-backed Points-ranked entry and must never collide with that unrelated type
// (spec SS2d.2).
export interface ProgressionLeaderboardEntry {
  profileId: string;
  fullName: string | null;
  pointsTotal: number;
  xpTotal: number;
  currentLevel: number;
  rank: number;
  churchId?: string;
}

export type SpeakerRequestStatus = "submitted" | "reviewed" | "contacted" | "declined";

export interface SpeakerRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  churchAffiliation: string | null;
  churchId: string | null;
  churchName: string | null;
  topic: string | null;
  bio: string | null;
  message: string | null;
  headshotUrl: string | null;
  status: SpeakerRequestStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Plotabl Workforce (Phase 1: module shell only -- see docs/PLOTABL_WORKFORCE_BUILD_TRACKER.md) ---

export interface WorkforceModuleSettings {
  churchId: string;
  enabled: boolean;
  enabledBy: string | null;
  enabledAt: string | null;
}

export interface WorkforceDepartment {
  id: string;
  churchId: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
}

// module_owner/platform_owner are intentionally absent -- they map to existing
// private.is_church_manager (church_memberships host/admin + profiles.is_platform_admin), not a
// new role row. See migration 0044's header comment.
export type WorkforceRole = "stakeholder" | "department_leadership" | "manager" | "employee" | "intern" | "vendor";

export interface WorkforceRoleAssignment {
  id: string;
  churchId: string;
  profileId: string;
  role: WorkforceRole;
  departmentId: string | null;
  createdAt: string;
}

// What a signed-in profile is allowed to do with Workforce for one org: entitled reflects
// wf_module_settings.enabled; isManager reflects private.is_church_manager (org admin, so always
// entitled to configure the module regardless of enabled); roles is every wf_role_assignments row
// for that profile in that org (empty array is valid -- a manager may hold zero explicit roles).
export interface WorkforceAccess {
  churchId: string;
  entitled: boolean;
  isManager: boolean;
  roles: WorkforceRoleAssignment[];
}

// --- Plotabl Workforce Phase 2: Decision Pool + expanded preview ---

export type WorkforceDecisionStatus =
  | "draft"
  | "stakeholder_review"
  | "awaiting_leadership_approval"
  | "department_translation"
  | "management_planning"
  | "employee_activation"
  | "in_implementation"
  | "measuring_outcomes"
  | "completed"
  | "on_hold"
  | "archived";

export type WorkforceDecisionPriority = "standard" | "elevated" | "strategic" | "critical";
export type WorkforceDecisionSecurity = "public" | "internal" | "restricted" | "confidential";

export interface WorkforceDecision {
  id: string;
  churchId: string;
  decisionNumber: string;
  title: string;
  status: WorkforceDecisionStatus;
  priority: WorkforceDecisionPriority;
  security: WorkforceDecisionSecurity;
  departmentId: string | null;
  controllingStakeholderGroup: string | null;
  decisionOwner: string | null;
  decisionOwnerName: string | null;
  executiveIntent: string | null;
  desiredOutcome: string | null;
  targetDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
}

export interface WorkforceDecisionParticipant {
  id: string;
  decisionId: string;
  profileId: string;
  profileName: string | null;
  profileAvatarUrl: string | null;
  role: WorkforceRole;
  addedBy: string | null;
  createdAt: string;
}

export type WorkforceInvitationTargetScope = "department" | "department_leadership" | "specific_person";
export type WorkforceInvitationStatus = "pending" | "approved" | "declined";

export interface WorkforceDecisionInvitationRequest {
  id: string;
  decisionId: string;
  churchId: string;
  targetScope: WorkforceInvitationTargetScope;
  departmentId: string | null;
  targetProfileId: string | null;
  status: WorkforceInvitationStatus;
  requestedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
