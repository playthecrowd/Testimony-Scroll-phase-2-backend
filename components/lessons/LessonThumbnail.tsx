"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

// next/image throws if it's asked to optimize a host that isn't in next.config's remotePatterns
// (Supabase Storage + the two mock placeholder hosts used by seed/demo data). Rather than let an
// unexpected host crash the card, fall back to a plain <img> for anything outside that allowlist --
// still gets object-cover/aspect-ratio/fallback behavior, just without Next's image optimizer.
const KNOWN_IMAGE_HOSTS = ["picsum.photos", "ui-avatars.com"];

function supabaseStorageHostname(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
}

function isOptimizableHost(src: string): boolean {
  try {
    const hostname = new URL(src).hostname;
    const supabaseHost = supabaseStorageHostname();
    return hostname === supabaseHost || KNOWN_IMAGE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

interface LessonThumbnailProps {
  src?: string | null;
  alt?: string | null;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: string;
  /** "video" (16:9, default, used for cards/hero) or "square" (compact list-row thumbnails). */
  aspect?: "video" | "square";
  children?: React.ReactNode;
}

export function LessonThumbnail({
  src,
  alt,
  className,
  imgClassName,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority = false,
  rounded = "rounded-xl",
  aspect = "video",
  children,
}: LessonThumbnailProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showFallback = !src || errored;
  const optimizable = useMemo(() => (src ? isOptimizableHost(src) : false), [src]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface-2",
        aspect === "video" ? "aspect-video" : "aspect-square",
        rounded,
        className
      )}
    >
      {!showFallback && optimizable && (
        <Image
          src={src!}
          alt={alt || ""}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", imgClassName)}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {!showFallback && !optimizable && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt || ""}
          className={cn("w-full h-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", imgClassName)}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {!showFallback && !loaded && <div className="absolute inset-0 animate-pulse bg-surface-2" />}
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-blue/10 to-accent-purple/10">
          <Compass size={28} className="text-accent-blue-light/60" strokeWidth={1.5} />
        </div>
      )}
      {children}
    </div>
  );
}
