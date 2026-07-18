"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { requirePlatformAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  createEpisode,
  updateEpisode,
  updateEpisodeStatus,
  replaceEpisodeCharacters,
  replaceEpisodeLessons,
  EpisodeInput,
} from "@/services/supabase/episodes";
import { PublishedEpisodeStatus } from "@/types";

export interface EpisodeActionResult {
  error?: string;
  id?: string;
}

function revalidateEpisodePaths(id?: string) {
  revalidatePath("/admin/episodes");
  revalidatePath("/episodes");
  revalidatePath("/story");
  if (id) {
    revalidatePath(`/admin/episodes/${id}/edit`);
    revalidatePath(`/episodes/${id}`);
  }
}

export async function createEpisodeAction(input: EpisodeInput): Promise<EpisodeActionResult> {
  if (!input.title.trim()) return { error: "Episode title is required." };

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    const episode = await createEpisode(supabase, input);
    revalidateEpisodePaths();
    return { id: episode.id };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[createEpisodeAction] Unexpected error:", err);
    return { error: "Something went wrong creating this episode. Please try again." };
  }
}

export async function updateEpisodeAction(id: string, input: EpisodeInput): Promise<EpisodeActionResult> {
  if (!input.title.trim()) return { error: "Episode title is required." };

  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateEpisode(supabase, id, input);
    revalidateEpisodePaths(id);
    return { id };
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateEpisodeAction] Unexpected error:", err);
    return { error: "Something went wrong saving this episode. Please try again." };
  }
}

export async function updateEpisodeStatusAction(id: string, status: PublishedEpisodeStatus): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await updateEpisodeStatus(supabase, id, status);
    await logAdminAction(supabase, { action: `episode_${status}`, entityType: "episode", entityId: id });
    revalidateEpisodePaths(id);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateEpisodeStatusAction] Unexpected error:", err);
    return { error: "Couldn't update this episode's status. Please try again." };
  }
}

export async function updateEpisodeCharactersAction(
  episodeId: string,
  entries: { characterId: string; roleNote: string }[]
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await replaceEpisodeCharacters(
      supabase,
      episodeId,
      entries.map((e) => ({ characterId: e.characterId, roleNote: e.roleNote || null }))
    );
    revalidateEpisodePaths(episodeId);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateEpisodeCharactersAction] Unexpected error:", err);
    return { error: "Couldn't save character connections. Please try again." };
  }
}

export async function updateEpisodeLessonsAction(episodeId: string, lessonIds: string[]): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const authError = await requirePlatformAdmin(supabase);
    if (authError) return { error: authError };

    await replaceEpisodeLessons(supabase, episodeId, lessonIds);
    revalidateEpisodePaths(episodeId);
    return {};
  } catch (err) {
    if (err instanceof SupabaseConfigError) return { error: err.message };
    console.error("[updateEpisodeLessonsAction] Unexpected error:", err);
    return { error: "Couldn't save lesson connections. Please try again." };
  }
}
