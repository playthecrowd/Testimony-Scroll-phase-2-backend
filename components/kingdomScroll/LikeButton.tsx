"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toggleTestimonyLike } from "@/services/supabase/testimonies";

// Direct authenticated client call rather than a server action -- same pattern
// StudiedClient.tsx's checklist toggles already use for a simple, RLS-gated write.
export function LikeButton({ testimonyId, initialCount, initialLiked }: { testimonyId: string; initialCount: number; initialLiked: boolean }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError("");
    const nextLiked = !liked;
    try {
      const supabase = createClient();
      await toggleTestimonyLike(supabase, testimonyId, nextLiked);
      setLiked(nextLiked);
      setCount((c) => c + (nextLiked ? 1 : -1));
    } catch (err) {
      console.error("[LikeButton] Failed to toggle like:", err);
      setError("Sign in to like this testimony.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={busy}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
          liked ? "border-accent-blue-light bg-accent-blue/15 text-accent-blue-light" : "border-border-subtle text-foreground hover:border-accent-blue-light"
        }`}
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} /> {count}
      </button>
      {error && <p className="text-xs text-red-300 mt-1.5">{error}</p>}
    </div>
  );
}
