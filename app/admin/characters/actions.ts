"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { createCharacter, updateCharacter, replaceCharacterTestimonies, CharacterInput } from "@/services/supabase/characters";

export interface CharacterActionResult {
  error?: string;
  id?: string;
}

export async function createCharacterAction(input: CharacterInput): Promise<CharacterActionResult> {
  if (!input.name.trim()) return { error: "Character name is required." };

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    const character = await createCharacter(supabase, input);
    revalidatePath("/admin/characters");
    revalidatePath("/characters");
    return { id: character.id };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[createCharacterAction] Unexpected error:", err);
    return { error: "Something went wrong creating this character. Please try again." };
  }
}

export async function updateCharacterAction(id: string, input: CharacterInput): Promise<CharacterActionResult> {
  if (!input.name.trim()) return { error: "Character name is required." };

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateCharacter(supabase, id, input);
    revalidatePath("/admin/characters");
    revalidatePath(`/admin/characters/${id}/edit`);
    revalidatePath("/characters");
    revalidatePath(`/characters/${id}`);
    return { id };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateCharacterAction] Unexpected error:", err);
    return { error: "Something went wrong saving this character. Please try again." };
  }
}

export async function updateCharacterTestimoniesAction(
  characterId: string,
  entries: { testimonyId: string; note: string }[]
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await replaceCharacterTestimonies(
      supabase,
      characterId,
      entries.map((e) => ({ testimonyId: e.testimonyId, note: e.note || null }))
    );
    revalidatePath(`/admin/characters/${characterId}/edit`);
    revalidatePath(`/characters/${characterId}`);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateCharacterTestimoniesAction] Unexpected error:", err);
    return { error: "Couldn't save testimony connections. Please try again." };
  }
}
