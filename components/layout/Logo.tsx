import Link from "next/link";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" | "lg" }) {
  const iconSize = size === "lg" ? 34 : size === "sm" ? 22 : 28;
  return (
    <Link href={href} className="flex items-center gap-2.5 focus-ring rounded-lg">
      <span className="relative flex items-center justify-center rounded-full bg-accent-blue/15 border border-accent-blue/40 qk-glow-blue" style={{ width: iconSize + 14, height: iconSize + 14 }}>
        <Compass size={iconSize} className="text-accent-blue-light" strokeWidth={1.75} />
      </span>
      <span className="leading-none">
        <span className={cn("block font-bold tracking-wide text-foreground", size === "lg" ? "text-xl" : "text-base")}>
          QUEST
        </span>
        <span className="block text-[10px] tracking-[0.2em] text-muted -mt-0.5">FOR THE KINGDOM</span>
      </span>
    </Link>
  );
}
