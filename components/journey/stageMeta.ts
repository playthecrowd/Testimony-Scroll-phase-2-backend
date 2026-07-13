import { Compass, BookOpen, Box, UserRound, ScrollText, LucideIcon } from "lucide-react";
import { JourneyStage } from "@/types";

export interface StageMeta {
  key: Exclude<JourneyStage, "not-started">;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const stages: StageMeta[] = [
  { key: "captured", label: "Captured", description: "Churches capture sermons and lessons.", icon: Compass },
  { key: "studied", label: "Studied", description: "Members study and engage with key truths.", icon: BookOpen },
  { key: "experienced", label: "Experienced", description: "Join a 3D quest that brings the lesson to life.", icon: Box },
  { key: "applied", label: "Applied", description: "Share how the lesson applies in real life.", icon: UserRound },
  { key: "added-to-story", label: "Added to the Story", description: "Add your testimony to the Kingdom Scroll.", icon: ScrollText },
];

export function stageOrder(stage: JourneyStage): number {
  return ["not-started", "captured", "studied", "experienced", "applied", "added-to-story"].indexOf(stage);
}

export function stageStatus(current: JourneyStage, target: StageMeta["key"]): "locked" | "available" | "in-progress" | "completed" {
  const currentIdx = stageOrder(current);
  const targetIdx = stageOrder(target);
  if (targetIdx < currentIdx) return "completed";
  if (targetIdx === currentIdx) return "in-progress";
  if (targetIdx === currentIdx + 1) return "available";
  return "locked";
}
