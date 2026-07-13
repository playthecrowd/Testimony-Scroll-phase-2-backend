import { QuestResult } from "@/types";
import { seedQuestResults } from "@/data/quests";
import { loadCollection, saveCollection, newId } from "@/lib/storage";
import { getUserById, demoMember } from "@/data/users";

const KEY = "questResults";

export function getAllQuestResults(): QuestResult[] {
  return loadCollection<QuestResult>(KEY, seedQuestResults);
}

export function getQuestResultsForLesson(lessonId: string): QuestResult[] {
  return getAllQuestResults()
    .filter((q) => q.lessonId === lessonId)
    .sort((a, b) => b.score - a.score);
}

export function getUserQuestResult(userId: string, lessonId: string): QuestResult | undefined {
  return getAllQuestResults().find((q) => q.userId === userId && q.lessonId === lessonId);
}

export function simulateQuestCompletion(userId: string, lessonId: string, hostId: string): QuestResult {
  const all = loadCollection<QuestResult>(KEY, seedQuestResults);
  const totalQuestions = 10 + Math.floor(Math.random() * 6);
  const correctAnswers = Math.max(1, totalQuestions - Math.floor(Math.random() * 3));
  const objectsTotal = 6 + Math.floor(Math.random() * 5);
  const objectsCollected = Math.max(1, objectsTotal - Math.floor(Math.random() * 2));
  const score = correctAnswers * 650 + objectsCollected * 120 + Math.floor(Math.random() * 300);
  const minutes = 14 + Math.floor(Math.random() * 8);
  const seconds = Math.floor(Math.random() * 60);

  const result: QuestResult = {
    id: newId("questresult"),
    userId,
    lessonId,
    hostId,
    score,
    correctAnswers,
    totalQuestions,
    objectsCollected,
    objectsTotal,
    completionTime: `${minutes}:${seconds.toString().padStart(2, "0")}`,
    completedAt: new Date().toISOString(),
  };

  const updated = [...all, result];
  saveCollection(KEY, updated);
  return result;
}

export function getLeaderboard(lessonId?: string) {
  const results = lessonId ? getAllQuestResults().filter((q) => q.lessonId === lessonId) : getAllQuestResults();
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return sorted.map((r, i) => {
    const user = getUserById(r.userId) ?? demoMember;
    return {
      rank: i + 1,
      userId: r.userId,
      userName: user.fullName,
      userAvatarUrl: user.avatarUrl,
      score: r.score,
      time: r.completionTime,
      date: r.completedAt.slice(0, 10),
      lessonId: r.lessonId,
    };
  });
}
