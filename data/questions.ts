import { StudyQuestion } from "@/types";

const bank: Record<string, string[]> = {
  "lesson-faith-moves-mountains": [
    "What mountains are you currently facing in your life?",
    "How does Matthew 17:20 challenge your understanding of faith?",
    "What step of obedience is God calling you to take this week?",
    "When has God asked you to trust Him before you saw the outcome?",
    "How does community strengthen your faith when the journey gets hard?",
  ],
  "lesson-narrow-path": [
    "What does it mean to take up your cross daily?",
    "Where in your life is the 'wide road' tempting you right now?",
    "What obstacle keeps you from walking the narrow path faithfully?",
    "How does obedience mark true discipleship in your own story?",
  ],
};

const defaultQuestions = [
  "What is the central truth of this passage?",
  "How does this apply to your current season?",
  "What is God inviting you to do in response?",
  "Who could you share this truth with this week?",
  "What is one action step you'll take today?",
];

export function getStudyQuestionsForLesson(lessonId: string): StudyQuestion[] {
  const questions = bank[lessonId] ?? defaultQuestions;
  return questions.map((q, i) => ({
    id: `${lessonId}-q${i + 1}`,
    lessonId,
    question: q,
  }));
}
