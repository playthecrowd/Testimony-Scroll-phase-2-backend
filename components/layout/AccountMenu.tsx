"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, User, LogOut, Shield } from "lucide-react";
import { useSession } from "@/context/SessionContext";

export function AccountMenu() {
  const { session, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="account-menu"
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/5 focus-ring"
      >
        <Image src={session.user.avatarUrl} alt={session.user.fullName} width={32} height={32} className="rounded-full" />
        <span className="hidden md:block text-left leading-tight">
          <span className="block text-sm font-semibold text-foreground">{session.user.fullName}</span>
          <span className="block text-[11px] text-muted">
            {session.accountType === "host" ? "Church Host" : "Kingdom Member"}
          </span>
        </span>
        <ChevronDown size={16} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 qk-card p-2 z-50 shadow-2xl">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5"
          >
            <User size={15} /> Profile
          </Link>
          <Link
            href={session.accountType === "host" ? "/host-dashboard" : "/dashboard"}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5"
          >
            <Shield size={15} /> {session.accountType === "host" ? "Host Dashboard" : "My Dashboard"}
          </Link>

          <div className="my-2 border-t border-border-subtle" />
          <button
            onClick={() => {
              logout();
              setOpen(false);
              window.location.href = "/";
            }}
            data-testid="sign-out"
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
