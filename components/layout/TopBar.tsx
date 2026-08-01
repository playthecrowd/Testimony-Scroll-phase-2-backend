"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { Logo } from "./Logo";
import { AccountMenu } from "./AccountMenu";
import { LinkButton } from "@/components/ui/Button";
import { useSession } from "@/context/SessionContext";
import { getUnreadCount } from "@/services/notificationService";
import { cn } from "@/lib/utils";
import { visibleTopBarLinks } from "@/lib/navigation";
import { isEntityManagerAccountType } from "@/lib/accountType";

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { session, ready } = useSession();
  const pathname = usePathname();
  const unread = ready && session.isLoggedIn ? getUnreadCount(session.user.id) : 0;
  const isEntityManager = ready && session.isLoggedIn && isEntityManagerAccountType(session.accountType);
  const navLinks = visibleTopBarLinks(isEntityManager);

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

        {/* Repair Batch 5, D7 (Trello iCj9X9zs): at the lg breakpoint's narrower end (~1024-1300px),
            the Host-only extra link ("Experience Builder") pushed total row width past what fit,
            and individual link text wrapped mid-word instead of the row handling the overflow.
            whitespace-nowrap stops that; the tighter gap/padding buys back the room the extra
            Host-only link needs to still fit on one line at the same breakpoint. */}
        <nav className="hidden lg:flex items-center gap-0.5 shrink-0">
          {navLinks.map((link, i) => (
            <Link
              key={link.label + i}
              href={link.href}
              className={cn(
                "px-2.5 py-2 text-sm rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap",
                pathname === link.href && "text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {ready && session.isLoggedIn && (
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
          )}
          {!ready || !session.isLoggedIn ? (
            <LinkButton href="/login" size="sm" variant="outline" className="gap-1.5">
              Sign In
            </LinkButton>
          ) : (
            <AccountMenu />
          )}
          {/* Always visible, signed in or not -- /experience-builder's own page-level gate
              (host-only) already handles a non-host or signed-out visitor correctly; no new
              authorization surface needed here. */}
          <LinkButton href="/experience-builder" size="sm" variant="gold" className="hidden sm:inline-flex">
            Create Experience
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
