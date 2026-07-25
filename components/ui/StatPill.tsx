import { LucideIcon } from "lucide-react";
import Link from "next/link";

export function StatPill({
  icon: Icon,
  value,
  label,
  trend,
  href,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="w-10 h-10 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue-light shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted mt-1 truncate">{label}</p>
        {trend && <p className="text-[11px] text-accent-blue-light mt-0.5">{trend}</p>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="qk-card px-4 py-3.5 flex items-center gap-3 hover:border-accent-blue-light/50 transition-colors">
        {content}
      </Link>
    );
  }

  return <div className="qk-card px-4 py-3.5 flex items-center gap-3">{content}</div>;
}

export function SectionCard({
  title,
  action,
  actionHref,
  children,
  icon: Icon,
}: {
  title: string;
  action?: string;
  actionHref?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="qk-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {Icon && <Icon size={16} className="text-accent-blue-light" />}
          {title}
        </h2>
        {action && actionHref && (
          <Link href={actionHref} className="text-xs text-accent-blue-light hover:underline">
            {action}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
