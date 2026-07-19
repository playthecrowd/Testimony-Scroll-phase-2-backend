import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { getPlatformAdminGate } from "@/lib/adminAuth";
import { ErrorState } from "@/components/ui/AsyncState";
import { NotAuthorized } from "@/components/admin/NotAuthorized";
import { CharacterForm } from "@/components/admin/CharacterForm";
import { CharacterTestimoniesEditor } from "@/components/admin/CharacterTestimoniesEditor";
import { getCharacterById } from "@/services/supabase/characters";
import { getApprovedPublicTestimonies } from "@/services/supabase/testimonies";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let gate;
  try {
    gate = await getPlatformAdminGate(supabase);
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

  if (!gate.userId) redirect("/login");
  if (!gate.isPlatformAdmin) return <NotAuthorized />;

  const [character, approvedTestimonies] = await Promise.all([
    getCharacterById(supabase, id),
    getApprovedPublicTestimonies(supabase),
  ]);
  if (!character) notFound();

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link href="/admin/characters" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft size={15} /> Back to Characters
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Edit {character.name}</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <CharacterForm character={character} />
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Contributing Testimonies</h2>
          <CharacterTestimoniesEditor characterId={character.id} approvedTestimonies={approvedTestimonies} initialSelections={character.testimonies} />
        </div>
      </div>
    </div>
  );
}
