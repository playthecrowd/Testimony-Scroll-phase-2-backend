import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { ErrorState } from "@/components/ui/AsyncState";
import { LinkButton } from "@/components/ui/Button";
import { getMyHostChurches, getChurchMinistries } from "@/services/supabase/churches";
import { ChurchMinistry } from "@/types";
import { ChurchProfileForm } from "./ChurchProfileForm";
import { CopySpeakerLinkCard } from "@/components/hostDashboard/CopySpeakerLinkCard";
import { entityLabel } from "@/lib/entityLabel";

export const dynamic = "force-dynamic";

export default async function ChurchProfilePage() {
  const supabase = await createClient();

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
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

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center px-4">
        <p className="text-foreground font-semibold mb-2">Sign in as a Church Host or Organization manager to edit your profile.</p>
        <LinkButton href="/login">Sign In</LinkButton>
      </div>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();

  let churches;
  try {
    churches = await getMyHostChurches(supabase);
  } catch (err) {
    console.error("[ChurchProfilePage] Failed to load managed churches:", err);
    return (
      <div className="max-w-lg mx-auto px-4 py-24">
        <ErrorState message="We couldn't load your church right now. Please try again shortly." />
      </div>
    );
  }
  if (churches.length === 0) {
    redirect(profile?.account_type === "organization" ? "/onboarding/organization" : "/onboarding/church");
  }
  const church = churches[0];
  const entityType = church.entityType ?? "church";

  let ministries: ChurchMinistry[];
  try {
    ministries = await getChurchMinistries(supabase, church.id);
  } catch (err) {
    console.error("[ChurchProfilePage] Failed to load ministries:", err);
    ministries = [];
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{entityLabel(entityType, "profile")}</h1>
      <p className="text-muted text-sm mb-6">Edit the information members and visitors see about {church.name}.</p>
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        <ChurchProfileForm church={church} ministries={ministries} />
        <CopySpeakerLinkCard churchSlug={church.slug} />
      </div>
    </div>
  );
}
