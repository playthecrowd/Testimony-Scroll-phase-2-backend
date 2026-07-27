"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Server Components (app/characters/page.tsx, .../[characterId]/page.tsx) can't attach onError
// directly to a plain <img> -- event handlers aren't serializable across the RSC boundary -- so
// the image-failure fallback lives in this one small Client Component instead, reused by both.
export function CharacterAvatarImage({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-surface-2 text-muted", className)}>
        <UserRound size={28} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setFailed(true)} className={cn("w-full h-full object-cover", className)} />
  );
}
