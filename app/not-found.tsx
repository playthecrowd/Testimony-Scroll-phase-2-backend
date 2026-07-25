import { Compass } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/Button";

// Repair Batch 4, D6 (Trello crZzn7LH): with no app/not-found.tsx, Next.js fell back to its
// default unstyled 404 page for any invalid dynamic route -- no app branding, no way back in.
export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <Logo size="lg" />
      <div className="mt-8 w-16 h-16 rounded-full bg-accent-blue/15 border border-accent-blue/40 qk-glow-blue flex items-center justify-center">
        <Compass size={30} className="text-accent-blue-light" strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mt-6">Page not found</h1>
      <p className="text-muted text-sm md:text-base mt-3 max-w-sm">
        This part of the journey doesn&apos;t exist yet. Let&apos;s get you back on the path.
      </p>
      <LinkButton href="/" size="lg" className="mt-7">
        Back home
      </LinkButton>
    </div>
  );
}
