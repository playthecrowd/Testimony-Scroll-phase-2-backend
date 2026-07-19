import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyHostChurches } from "@/services/supabase/churches";
import { HostEventForm } from "./HostEventForm";

export const dynamic = "force-dynamic";

export default async function HostEventPage() {
  const supabase = await createClient();

  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return (
        <div className="max-w-lg mx-auto px-4 py-24">
          <ErrorState message={err.message} />
        </div>
      );
    }
    throw err;
  }

  if (!userId) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in to request an event.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  let myChurches: Awaited<ReturnType<typeof getMyHostChurches>> = [];
  try {
    myChurches = await getMyHostChurches(supabase);
  } catch (err) {
    console.error("[HostEventPage] Failed to load managed churches:", err);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Host an Event</h1>
      <p className="text-muted text-sm mb-6">
        Request a pop-up, ticketed, game day, or church event. Quest for the Kingdom reviews every request before
        it goes on the calendar.
      </p>
      <HostEventForm myChurches={myChurches} />
    </div>
  );
}
