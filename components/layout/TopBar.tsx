"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { Logo } from "./Logo";
import { AccountMenu } from "./AccountMenu";
import { LinkButton } from "@/components/ui/Button";
import { useSession } from "@/context/SessionContext";
import { getUnreadCount } from "@/services/notificationService";
import { cn } from "@/lib/utils";
import { visibleTopBarLinks } from "@/lib/navigation";

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { session, ready } = useSession();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const isHost = ready && session.isLoggedIn && session.accountType === "host";
  const navLinks = visibleTopBarLinks(isHost);

  useEffect(() => {
    if (ready && session.isLoggedIn) setUnread(getUnreadCount(session.user.id));
  }, [ready, session, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/85 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 text-muted hover:text-foreground focus-ring rounded-lg">
              <Menu size={20} />
            </button>
          )}
          <Logo />
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link, i) => (
            <Link
              key={link.label + i}
              href={link.href}
              className={cn(
                "px-3 py-2 text-sm rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors",
                pathname === link.href && "text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {ready && session.isLoggedIn ? (
            <>
              <Link
                href="/notifications"
                className="relative p-2 rounded-full hover:bg-white/5 text-muted hover:text-foreground focus-ring"
                aria-label="Notifications"
              >
                <Bell size={19} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-blue text-[10px] flex items-center justify-center text-white">
                    {unread}
                  </span>
                )}
              </Link>
              <AccountMenu />
            </>
          ) : (
            <LinkButton href="/login" size="sm" variant="outline" className="gap-1.5">
              Sign In
            </LinkButton>
          )}
        </div>
      </div>
    </header>
  );
}
