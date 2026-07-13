import { Badge } from "@/types";

export const badgeCatalog: Badge[] = [
  {
    id: "badge-captured",
    stage: "captured",
    name: "Lesson Captured Badge",
    description: "Awarded for starting a lesson journey.",
    icon: "compass",
    color: "blue",
  },
  {
    id: "badge-studied",
    stage: "studied",
    name: "Lesson Studied Badge",
    description: "Awarded for completing the Studied stage of a lesson.",
    icon: "book-open",
    color: "blue",
  },
  {
    id: "badge-experienced",
    stage: "experienced",
    name: "Quest Experience Badge",
    description: "Awarded for completing the connected 3D Quest.",
    icon: "box",
    color: "purple",
  },
  {
    id: "badge-applied",
    stage: "applied",
    name: "Kingdom Application Badge",
    description: "Awarded for applying truth and sharing your story.",
    icon: "user-round",
    color: "purple",
  },
  {
    id: "badge-added-to-story",
    stage: "added-to-story",
    name: "Kingdom Scroll Contributor Seal",
    description: "Awarded when your testimony is published to the Kingdom Scroll.",
    icon: "scroll",
    color: "gold",
  },
  {
    id: "badge-full-journey",
    stage: "full-journey",
    name: "Full Kingdom Journey Badge",
    description: "Awarded for completing every stage of a lesson journey.",
    icon: "crown",
    color: "gold",
  },
];

export function getBadgeByStage(stage: Badge["stage"]) {
  return badgeCatalog.find((b) => b.stage === stage)!;
}

export function getBadgeById(id: string) {
  return badgeCatalog.find((b) => b.id === id);
}
