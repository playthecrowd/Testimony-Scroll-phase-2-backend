"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Feather, Award, CheckCircle2, Info } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getUserNotifications, markAllRead } from "@/services/notificationService";
import { AppNotification } from "@/types";
import { formatDate, cn } from "@/lib/utils";
import { LinkButton, Button } from "@/components/ui/Button";

const iconMap: Record<AppNotification["type"], React.ElementType> = {
  "testimony-invitation": Feather,
  "badge-earned": Award,
  "review-approved": CheckCircle2,
  system: Info,
};

export default function NotificationsPage() {
  const { session, ready } = useSession();
  // refreshKey's value is never read -- setting it just forces a re-render, which recomputes
  // `notifs` below from the (mutated) notification store after markAllRead() runs.
  const [, setRefreshKey] = useState(0);
  const notifs = ready && session.isLoggedIn ? getUserNotifications(session.user.id) : [];

  if (!ready) return null;
  if (!session.isLoggedIn) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to view notifications.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Bell size={24} className="text-accent-blue-light" /> Notifications
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            markAllRead(session.user.id);
            setRefreshKey((k) => k + 1);
          }}
        >
          Mark all read
        </Button>
      </div>

      <div className="space-y-2">
        {notifs.map((n) => {
          const Icon = iconMap[n.type];
          return (
            <div key={n.id} className={cn("qk-card p-4 flex items-start gap-3", !n.read && "border-accent-blue/40")}>
              <div className="w-9 h-9 rounded-full bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue-light shrink-0">
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-sm text-muted mt-0.5">{n.message}</p>
                <p className="text-[11px] text-muted mt-1.5">{formatDate(n.createdAt)}</p>
              </div>
              {n.ctaHref && n.ctaLabel && (
                <Link href={n.ctaHref} className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-border-subtle hover:border-accent-blue-light text-foreground">
                  {n.ctaLabel}
                </Link>
              )}
              {!n.read && <span className="w-2 h-2 rounded-full bg-accent-blue-light shrink-0 mt-1.5" />}
            </div>
          );
        })}
        {notifs.length === 0 && <p className="text-sm text-muted text-center py-16">You&apos;re all caught up.</p>}
      </div>
    </div>
  );
}
