import { Journey, JourneyStage } from "@/types";
import { seedJourneys } from "@/data/journeys";
import { loadCollection, saveCollection, newId } from "@/lib/storage";
import { awardBadge } from "@/services/badgeService";

const KEY = "journeys";

const STAGE_PROGRESS: Record<JourneyStage, number> = {
  "not-started": 0,
  captured: 15,
  studied: 40,
  experienced: 60,
  applied: 80,
  "added-to-story": 100,
};

export function getUserJourneys(userId: string): Journey[] {
  return loadCollection<Journey>(KEY, seedJourneys).filter((j) => j.userId === userId);
}

export function getJourney(userId: string, lessonId: string): Journey | undefined {
  return getUserJourneys(userId).find((j) => j.lessonId === lessonId);
}

function updateJourney(userId: string, lessonId: string, patch: Partial<Journey>): Journey {
  const all = loadCollection<Journey>(KEY, seedJourneys);
  const idx = all.findIndex((j) => j.userId === userId && j.lessonId === lessonId);
  if (idx === -1) {
    const created: Journey = {
      id: newId("journey"),
      userId,
      lessonId,
      stage: "captured",
      progressPercent: STAGE_PROGRESS.captured,
      startedAt: new Date().toISOString(),
      checklist: {
        notesStudied: false,
        videoWatched: false,
        audioListened: false,
        slidesViewed: false,
        questionsAnswered: false,
      },
      ...patch,
    };
    saveCollection(KEY, [...all, created]);
    return created;
  }
  const updated = { ...all[idx], ...patch };
  const next = [...all];
  next[idx] = updated;
  saveCollection(KEY, next);
  return updated;
}

export function startJourney(userId: string, lessonId: string): Journey {
  const existing = getJourney(userId, lessonId);
  if (existing) return existing;
  const journey = updateJourney(userId, lessonId, {
    stage: "captured",
    progressPercent: STAGE_PROGRESS.captured,
    startedAt: new Date().toISOString(),
  });
  awardBadge(userId, "captured", lessonId);
  return journey;
}

export function updateChecklistItem(
  userId: string,
  lessonId: string,
  key: keyof Journey["checklist"],
  value: boolean
): Journey {
  const journey = getJourney(userId, lessonId) ?? startJourney(userId, lessonId);
  const checklist = { ...journey.checklist, [key]: value };
  return updateJourney(userId, lessonId, { checklist });
}

export function completeStudied(userId: string, lessonId: string): Journey {
  const journey = getJourney(userId, lessonId) ?? startJourney(userId, lessonId);
  const updated = updateJourney(userId, lessonId, {
    stage: "studied",
    progressPercent: STAGE_PROGRESS.studied,
    studiedAt: new Date().toISOString(),
    checklist: {
      notesStudied: true,
      videoWatched: true,
      audioListened: journey.checklist.audioListened,
      slidesViewed: journey.checklist.slidesViewed,
      questionsAnswered: true,
    },
  });
  awardBadge(userId, "studied", lessonId);
  return updated;
}

export function completeExperienced(userId: string, lessonId: string, questResultId: string): Journey {
  const updated = updateJourney(userId, lessonId, {
    stage: "experienced",
    progressPercent: STAGE_PROGRESS.experienced,
    experiencedAt: new Date().toISOString(),
    questResultId,
  });
  awardBadge(userId, "experienced", lessonId);
  return updated;
}

export function markTestimonySubmitted(userId: string, lessonId: string, testimonyId: string): Journey {
  return updateJourney(userId, lessonId, {
    stage: "applied",
    progressPercent: STAGE_PROGRESS.applied,
    testimonyId,
  });
}

export function completeApplied(userId: string, lessonId: string): Journey {
  const updated = updateJourney(userId, lessonId, {
    stage: "applied",
    progressPercent: STAGE_PROGRESS.applied,
    appliedAt: new Date().toISOString(),
  });
  awardBadge(userId, "applied", lessonId);
  return updated;
}

export function completeAddedToStory(userId: string, lessonId: string): Journey {
  const updated = updateJourney(userId, lessonId, {
    stage: "added-to-story",
    progressPercent: STAGE_PROGRESS["added-to-story"],
    addedToStoryAt: new Date().toISOString(),
  });
  awardBadge(userId, "added-to-story", lessonId);
  awardBadge(userId, "full-journey", lessonId);
  return updated;
}

export function stageIndex(stage: JourneyStage): number {
  return ["not-started", "captured", "studied", "experienced", "applied", "added-to-story"].indexOf(stage);
}
