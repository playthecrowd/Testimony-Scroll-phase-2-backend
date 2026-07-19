import type { SupabaseClient } from "@supabase/supabase-js";
import { LessonJourney, LessonJourneyItem, PublishedLesson } from "@/types";
import { ChecklistItemKey } from "@/lib/journeyChecklist";
import { getLessonsByIds } from "./lessons";

const JOURNEY_SELECT = "id, lesson_id, current_stage, studied_started_at, studied_completed_at, last_opened_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJourney(row: any): LessonJourney {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    currentStage: row.current_stage,
    studiedStartedAt: row.studied_started_at,
    studiedCompletedAt: row.studied_completed_at,
    lastOpenedAt: row.last_opened_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(row: any): LessonJourneyItem {
  return { id: row.id, itemKey: row.item_key, completed: row.completed, completedAt: row.completed_at };
}

// Read-only -- used by the lesson detail page to decide Start vs Continue without creating
// anything. Only getOrCreateJourney (called from the Studied page itself) ever creates a journey,
// so there is exactly one code path that can produce a new row.
export async function getJourneyForLesson(supabase: SupabaseClient, lessonId: string): Promise<LessonJourney | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("lesson_journeys")
    .select(JOURNEY_SELECT)
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapJourney(data) : null;
}

// Conflict-safe via upsert on (user_id, lesson_id): repeated calls (double-click, revisit,
// bookmark) always resolve to the same single row. On conflict, only last_opened_at (and the
// harmlessly-identical user_id/lesson_id) are written -- current_stage and studied_completed_at
// from a prior session are never touched by re-opening the page.
export async function getOrCreateJourney(supabase: SupabaseClient, lessonId: string): Promise<LessonJourney> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to start a journey.");

  const { data, error } = await supabase
    .from("lesson_journeys")
    .upsert(
      { user_id: user.id, lesson_id: lessonId, last_opened_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    )
    .select(JOURNEY_SELECT)
    .single();
  if (error) throw error;
  return mapJourney(data);
}

export async function getJourneyItems(supabase: SupabaseClient, journeyId: string): Promise<LessonJourneyItem[]> {
  const { data, error } = await supabase
    .from("lesson_journey_items")
    .select("id, item_key, completed, completed_at")
    .eq("journey_id", journeyId);
  if (error) throw error;
  return (data ?? []).map(mapItem);
}

// Upsert on (journey_id, item_key) -- idempotent and duplicate-safe by construction, matching the
// stable-key strategy in lib/journeyChecklist.ts. Checking and unchecking are the same operation.
export async function setChecklistItemCompletion(
  supabase: SupabaseClient,
  journeyId: string,
  itemKey: ChecklistItemKey,
  completed: boolean
): Promise<LessonJourneyItem> {
  const { data, error } = await supabase
    .from("lesson_journey_items")
    .upsert(
      {
        journey_id: journeyId,
        item_key: itemKey,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "journey_id,item_key" }
    )
    .select("id, item_key, completed, completed_at")
    .single();
  if (error) throw error;
  return mapItem(data);
}

export async function touchLastOpened(supabase: SupabaseClient, journeyId: string): Promise<void> {
  const { error } = await supabase.from("lesson_journeys").update({ last_opened_at: new Date().toISOString() }).eq("id", journeyId);
  if (error) throw error;
}

// Advances current_stage to 'experienced' only, per PHASE 8 -- never to applied or
// added-to-story. Callers are expected to only invoke this when currentStage === "studied".
export async function markStudiedComplete(supabase: SupabaseClient, journeyId: string): Promise<LessonJourney> {
  const { data, error } = await supabase
    .from("lesson_journeys")
    .update({ current_stage: "experienced", studied_completed_at: new Date().toISOString() })
    .eq("id", journeyId)
    .select(JOURNEY_SELECT)
    .single();
  if (error) throw error;
  return mapJourney(data);
}

export interface UserJourneyWithLesson {
  journey: LessonJourney;
  lesson: PublishedLesson;
}

// For My Journey: the member's own journeys joined with their lessons. Two queries rather than a
// single embedded select, since lesson_journeys -> lessons isn't a relationship PublishedLesson's
// existing LESSON_SELECT is set up to embed from that direction -- simpler to reuse
// getLessonsByIds as-is than to introduce a second lesson-mapping path.
export async function getUserJourneysWithLessons(supabase: SupabaseClient): Promise<UserJourneyWithLesson[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lesson_journeys")
    .select(JOURNEY_SELECT)
    .eq("user_id", user.id)
    .order("last_opened_at", { ascending: false });
  if (error) throw error;

  const journeys = (data ?? []).map(mapJourney);
  if (journeys.length === 0) return [];

  const lessons = await getLessonsByIds(supabase, journeys.map((j) => j.lessonId));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  return journeys
    .map((journey) => {
      const lesson = lessonById.get(journey.lessonId);
      return lesson ? { journey, lesson } : null;
    })
    .filter((x): x is UserJourneyWithLesson => x !== null);
}
