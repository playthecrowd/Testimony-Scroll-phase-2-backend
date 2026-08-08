import { WorkforceImagePlaceholder } from "./WorkforceImagePlaceholder";

// The WF-02 hero visual. Swappable to real per-decision artwork later by changing only `src`
// (e.g. once decisions carry their own generated/uploaded image) -- nothing else about this
// component needs to change.
export function DecisionHeroVisual({ title, src = "/workforce/placeholders/future-factory-decision-hero.svg" }: { title: string; src?: string }) {
  return (
    <WorkforceImagePlaceholder
      src={src}
      alt={`Decision visual for ${title}`}
      aspectRatio="16 / 9"
      rounded="1.25rem"
      devLabel="Future Factory Decision Visual"
      className="border border-border-subtle shadow-sm"
    />
  );
}
