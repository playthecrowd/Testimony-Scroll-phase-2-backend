"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PublishedTestimony } from "@/types";

export function KingdomScrollList({ testimonies }: { testimonies: PublishedTestimony[] }) {
  const [search, setSearch] = useState("");
  const [church, setChurch] = useState("all");

  const churches = useMemo(() => {
    const names = new Set(testimonies.map((t) => t.churchName).filter((n): n is string => !!n));
    return Array.from(names).sort();
  }, [testimonies]);

  const filtered = useMemo(() => {
    return testimonies.filter((t) => {
      if (church !== "all" && t.churchName !== church) return false;
      if (search && !`${t.title} ${t.topic ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [testimonies, church, search]);

  return (
    <div>
      <div className="qk-card p-4 mb-5 grid sm:grid-cols-[1fr_220px] gap-3">
        <div className="relative min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search testimonies..."
            className="qk-input pl-9"
          />
        </div>
        <select value={church} onChange={(e) => setChurch(e.target.value)} className="qk-input">
          <option value="all">All Churches</option>
          {churches.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="qk-card p-10 text-center text-muted text-sm">No testimonies match right now.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Link key={t.id} href={`/kingdom-scroll/${t.id}`} className="qk-card p-4 flex flex-col gap-2 hover:border-accent-blue-light transition-colors">
              <p className="text-sm font-semibold text-foreground line-clamp-2">{t.title}</p>
              <p className="text-xs text-muted line-clamp-3">{t.writtenTestimony}</p>
              <p className="text-[11px] text-muted mt-auto pt-2">
                {t.displayName || "A Kingdom Member"} · {t.churchName || "Quest for the Kingdom"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
