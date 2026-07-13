import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "gold";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent-blue hover:bg-accent-blue-light text-white shadow-[0_0_20px_rgba(47,125,255,0.35)]",
  secondary: "bg-surface-2 hover:bg-white/10 text-foreground border border-border-subtle",
  ghost: "bg-transparent hover:bg-white/5 text-foreground",
  outline: "bg-transparent border border-border-subtle hover:border-accent-blue-light text-foreground",
  gold: "bg-accent-gold hover:brightness-110 text-[#231607] shadow-[0_0_20px_rgba(232,179,77,0.3)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-6 py-3.5 gap-2",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-ring disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...rest
}: BaseProps & React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-ring",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
