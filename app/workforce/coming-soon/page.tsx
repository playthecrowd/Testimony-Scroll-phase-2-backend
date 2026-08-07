import { notFound } from "next/navigation";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";

// The Workforce nav's information architecture is fixed (per the approved module-level menu) even
// though several sections aren't built yet -- linking every nav item to a real destination now,
// rather than only showing the sections that exist, matches this codebase's own established rule
// for unfinished routes (docs/REQUIRED_FEATURES.md: never link to a route that doesn't exist,
// show a coming-soon state instead of a 404 or a dead link).
export default async function WorkforceComingSoonPage({ searchParams }: { searchParams: Promise<{ feature?: string }> }) {
  if (process.env.NEXT_PUBLIC_ENABLE_WORKFORCE_MODULE !== "true") notFound();
  const { feature } = await searchParams;
  const label = feature || "This section";

  return (
    <div className="max-w-lg mx-auto py-24 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center mx-auto mb-5">
        <Layers size={24} className="text-accent-gold" />
      </div>
      <h1 className="text-xl font-semibold text-foreground mb-2">{label} is coming soon</h1>
      <p className="text-muted text-sm">This part of Plotabl Workforce is still being built.</p>
    </div>
  );
}
