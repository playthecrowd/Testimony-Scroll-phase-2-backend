// Dev/demo seed script -- NOT for production data. Populates Supabase with the same sample
// churches/speakers/lessons/media/hosts/ministries the Phase One mock prototype used, so the
// Lessons Library, Lesson Detail, and Church Archive pages have something to show, and so
// mock-page links (which use these lessons' `.slug` values) keep resolving.
//
// Safe to re-run: every row is upserted keyed on a deterministic id derived from the mock
// string id, so running this twice does not create duplicates.
//
// Usage: npm run seed   (requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL, see
// docs/SUPABASE_SETUP.md)

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { churches } from "../data/churches";
import { speakers } from "../data/speakers";
import { seedLessons } from "../data/lessons";
import { hosts } from "../data/hosts";
import { createAdminClient } from "../lib/supabase/admin";

// tsx doesn't auto-load .env files the way `next dev`/`next build` do -- load them manually.
function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

// Deterministic RFC-4122-v5-style UUID derived from a string, so re-seeding is idempotent
// without needing to track a separate id-mapping file. Dependency-free (Node's crypto only).
const SEED_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function deterministicUuid(name: string): string {
  const namespaceBytes = Buffer.from(SEED_NAMESPACE.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = createHash("sha1").update(Buffer.concat([namespaceBytes, nameBytes])).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function main() {
  const supabase = createAdminClient();

  console.log("Seeding churches...");
  const churchIdMap = new Map<string, string>();
  const churchRows = churches.map((c) => {
    const id = deterministicUuid(`church:${c.id}`);
    churchIdMap.set(c.id, id);
    return {
      id,
      name: c.name,
      slug: c.slug,
      logo_url: c.logoUrl,
      city: c.city,
      region: c.state,
      country: "US",
      member_count: c.memberCount,
      description: c.description,
      verified: c.verified,
      status: "published" as const,
      is_demo: true,
      created_by: null,
    };
  });
  {
    const { error } = await supabase.from("churches").upsert(churchRows, { onConflict: "id" });
    if (error) throw new Error(`churches upsert failed: ${error.message}`);
  }

  console.log("Seeding speakers...");
  const speakerIdMap = new Map<string, string>();
  const speakerRows = speakers.map((s) => {
    const id = deterministicUuid(`speaker:${s.id}`);
    speakerIdMap.set(s.id, id);
    return {
      id,
      church_id: churchIdMap.get(s.churchId),
      name: s.name,
      avatar_url: s.avatarUrl,
      bio: s.bio ?? null,
      is_demo: true,
    };
  });
  {
    const { error } = await supabase.from("speakers").upsert(speakerRows, { onConflict: "id" });
    if (error) throw new Error(`speakers upsert failed: ${error.message}`);
  }

  console.log("Seeding lessons...");
  const lessonIdMap = new Map<string, string>();
  const lessonRows = seedLessons.map((l) => {
    const id = deterministicUuid(`lesson:${l.id}`);
    lessonIdMap.set(l.id, id);
    return {
      id,
      slug: l.slug,
      title: l.title,
      short_description: l.shortDescription,
      about_text: l.aboutText,
      topic: l.topic,
      subject: l.subject,
      ministry_category: l.ministryCategory,
      church_id: churchIdMap.get(l.churchId),
      speaker_id: speakerIdMap.get(l.speakerId) ?? null,
      date: l.date,
      duration_label: l.durationLabel,
      lesson_type: l.lessonType,
      primary_scripture: l.primaryScripture,
      supporting_scriptures: l.supportingScriptures,
      tags: l.tags,
      featured_image_url: l.featuredImageUrl,
      quest_url: l.questUrl ?? null,
      quest_level: l.questLevel ?? null,
      xp_reward: l.xpReward ?? null,
      status: "published" as const,
      created_by: null,
      contributors_count: l.contributorsCount,
      is_demo: true,
    };
  });
  {
    const { error } = await supabase.from("lessons").upsert(lessonRows, { onConflict: "id" });
    if (error) throw new Error(`lessons upsert failed: ${error.message}`);
  }

  console.log("Seeding lesson media...");
  const lessonIds = [...lessonIdMap.values()];
  const mediaRows: Record<string, unknown>[] = [];
  for (const l of seedLessons) {
    const lessonId = lessonIdMap.get(l.id);
    if (!lessonId) continue;
    if (l.notesUrl) mediaRows.push({ lesson_id: lessonId, media_type: "notes", url: l.notesUrl, is_demo: true });
    if (l.videoUrl) mediaRows.push({ lesson_id: lessonId, media_type: "video", url: l.videoUrl, is_demo: true });
    if (l.audioUrl) mediaRows.push({ lesson_id: lessonId, media_type: "audio", url: l.audioUrl, is_demo: true });
    if (l.slidesUrl) mediaRows.push({ lesson_id: lessonId, media_type: "slides", url: l.slidesUrl, is_demo: true });
    if (l.pastedNotes)
      mediaRows.push({ lesson_id: lessonId, media_type: "notes", content: l.pastedNotes, is_demo: true });
  }
  // No natural unique key per media row -- clear previously-seeded demo media for these
  // lessons first, then re-insert, so re-running this script doesn't pile up duplicates.
  if (lessonIds.length) {
    const { error } = await supabase.from("lesson_media").delete().eq("is_demo", true).in("lesson_id", lessonIds);
    if (error) throw new Error(`lesson_media cleanup failed: ${error.message}`);
  }
  if (mediaRows.length) {
    const { error } = await supabase.from("lesson_media").insert(mediaRows);
    if (error) throw new Error(`lesson_media insert failed: ${error.message}`);
  }

  console.log("Seeding lesson hosts...");
  const hostRows: Record<string, unknown>[] = [];
  for (const l of seedLessons) {
    const lessonId = lessonIdMap.get(l.id);
    if (!lessonId) continue;
    for (const hs of l.hostSessions) {
      const host = hosts.find((h) => h.id === hs.hostId);
      if (!host) continue;
      const churchId = churchIdMap.get(host.churchId);
      if (!churchId) continue;
      hostRows.push({
        lesson_id: lessonId,
        church_id: churchId,
        status: hs.status,
        participant_count: hs.participantCount,
        schedule_label: hs.scheduleLabel ?? null,
        quest_url: hs.questUrl ?? null,
        is_demo: true,
      });
    }
  }
  if (lessonIds.length) {
    const { error } = await supabase.from("lesson_hosts").delete().eq("is_demo", true).in("lesson_id", lessonIds);
    if (error) throw new Error(`lesson_hosts cleanup failed: ${error.message}`);
  }
  if (hostRows.length) {
    const { error } = await supabase.from("lesson_hosts").insert(hostRows);
    if (error) throw new Error(`lesson_hosts insert failed: ${error.message}`);
  }

  console.log("Seeding ministries...");
  const ministryIdMap = new Map<string, string>(); // key: `${churchId}::${normalizedName}`
  const ministryRows: Record<string, unknown>[] = [];
  for (const l of seedLessons) {
    if (!l.ministryCategory) continue;
    const churchId = churchIdMap.get(l.churchId);
    if (!churchId) continue;
    const key = `${churchId}::${l.ministryCategory.trim().toLowerCase()}`;
    if (ministryIdMap.has(key)) continue;
    const id = deterministicUuid(`ministry:${key}`);
    ministryIdMap.set(key, id);
    ministryRows.push({ id, church_id: churchId, name: l.ministryCategory, is_demo: true });
  }
  if (ministryRows.length) {
    const { error } = await supabase.from("ministries").upsert(ministryRows, { onConflict: "id" });
    if (error) throw new Error(`ministries upsert failed: ${error.message}`);
  }

  console.log("Linking lessons to ministries...");
  const lessonMinistryRows: Record<string, unknown>[] = [];
  for (const l of seedLessons) {
    if (!l.ministryCategory) continue;
    const churchId = churchIdMap.get(l.churchId);
    const lessonId = lessonIdMap.get(l.id);
    if (!churchId || !lessonId) continue;
    const key = `${churchId}::${l.ministryCategory.trim().toLowerCase()}`;
    const ministryId = ministryIdMap.get(key);
    if (ministryId) lessonMinistryRows.push({ lesson_id: lessonId, ministry_id: ministryId });
  }
  if (lessonMinistryRows.length) {
    const { error } = await supabase
      .from("lesson_ministries")
      .upsert(lessonMinistryRows, { onConflict: "lesson_id,ministry_id" });
    if (error) throw new Error(`lesson_ministries upsert failed: ${error.message}`);
  }

  console.log(
    `Seed complete: ${churchRows.length} churches, ${speakerRows.length} speakers, ${lessonRows.length} lessons, ` +
      `${mediaRows.length} media rows, ${hostRows.length} host rows, ${ministryRows.length} ministries.`
  );
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
