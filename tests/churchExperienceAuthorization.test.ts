import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Phase 10.3: structural authorization guards for the Experience Platform's application code --
// this repo has no live Supabase project wired into `npm test`, so "sign in as a regular member
// and confirm a host action is rejected" can't run as a true integration test here (same
// limitation every prior phase has documented). This is the static substitute: it scans the
// actual TypeScript source (not migrations) for two invariants that must always hold regardless
// of any future edit -- (1) registration rows are never created via a direct client insert
// anywhere in the app, only through the SECURITY DEFINER RPCs, and (2) every host-facing
// server action actually calls one of the shared "authorized experience/occurrence/registration"
// guards before writing anything.

const REPO_ROOT = path.join(__dirname, "..");

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listTsFiles(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function readAllAppSource(): { path: string; content: string }[] {
  const dirs = ["app", "components", "services", "lib"].map((d) => path.join(REPO_ROOT, d));
  const files = dirs.filter((d) => {
    try {
      return statSync(d).isDirectory();
    } catch {
      return false;
    }
  }).flatMap(listTsFiles);
  return files.map((p) => ({ path: p, content: readFileSync(p, "utf8") }));
}

test("no application code directly inserts into church_experience_registrations -- registration only ever happens via the RPCs", () => {
  const sources = readAllAppSource();
  const offending = sources.filter((f) => /\.from\(\s*["']church_experience_registrations["']\s*\)\s*\.insert\(/.test(f.content));
  assert.deepEqual(
    offending.map((f) => path.relative(REPO_ROOT, f.path)),
    [],
    "Found a direct .insert() into church_experience_registrations outside the approved RPC path"
  );
});

test("host Experience server actions call the shared authorized-experience/occurrence/registration guards", () => {
  const actionsPath = path.join(REPO_ROOT, "app", "host-dashboard", "experiences", "actions.ts");
  const source = readFileSync(actionsPath, "utf8");
  assert.match(source, /getAuthorizedExperience\(/);
  assert.match(source, /getAuthorizedOccurrence\(/);
  assert.match(source, /getAuthorizedRegistration\(/);
  // Every guard must actually verify church_memberships access, not just look up the row.
  assert.match(source, /requireChurchAccess\(/);
});

test("member Experience actions only call the RPC wrapper functions, never a direct table write, for registration/cancellation", () => {
  const actionsPath = path.join(REPO_ROOT, "app", "experiences", "actions.ts");
  const source = readFileSync(actionsPath, "utf8");
  assert.match(source, /registerForOccurrence\(/);
  assert.match(source, /cancelRegistration\(/);
  assert.doesNotMatch(source, /\.from\(\s*["']church_experience_registrations["']\s*\)/, "Member actions must never touch the registrations table directly, only via the RPC wrapper functions");
});

test("createExperienceAction and createOccurrenceAction verify church access before writing, never trusting a client-supplied churchId alone", () => {
  const actionsPath = path.join(REPO_ROOT, "app", "host-dashboard", "experiences", "actions.ts");
  const source = readFileSync(actionsPath, "utf8");
  const createExperienceMatch = source.match(/export async function createExperienceAction[\s\S]*?\n}\n/);
  assert.ok(createExperienceMatch, "Expected createExperienceAction to be defined");
  assert.match(createExperienceMatch![0], /requireChurchAccess\(supabase, user\.id, input\.churchId\)/);

  const createOccurrenceMatch = source.match(/export async function createOccurrenceAction[\s\S]*?\n}\n/);
  assert.ok(createOccurrenceMatch, "Expected createOccurrenceAction to be defined");
  assert.match(createOccurrenceMatch![0], /getAuthorizedExperience\(supabase, input\.experienceId\)/);
  assert.match(createOccurrenceMatch![0], /archived Experiences cannot receive new occurrences/i);
});

test("walk-ins and attendance/completion actions are all church-manager-gated, never member-self-service", () => {
  const actionsPath = path.join(REPO_ROOT, "app", "host-dashboard", "experiences", "actions.ts");
  const source = readFileSync(actionsPath, "utf8");
  for (const fnName of ["recordWalkInAction", "updateAttendanceStatusAction", "updateCompletionStatusAction", "updateRegistrationStatusAction"]) {
    const fnMatch = source.match(new RegExp(`export async function ${fnName}[\\s\\S]*?\\n}\\n`));
    assert.ok(fnMatch, `Expected ${fnName} to be defined`);
    assert.match(fnMatch![0], /getAuthorized(Occurrence|Registration)\(/, `${fnName} must call a shared church-manager authorization guard`);
  }
});

// Phase 10.4 perf finding: the member Experience detail page used to call
// getMyRegistrationForOccurrence once per occurrence (Promise.all over a .map), firing one query
// per occurrence instead of a single batched query. Guards against that N+1 shape regressing.
test("getMyRegistrationsForOccurrences batches with a single .in() query, not one query per occurrence id", () => {
  const servicePath = path.join(REPO_ROOT, "services", "supabase", "churchExperiences.ts");
  const source = readFileSync(servicePath, "utf8");
  const fnMatch = source.match(/export async function getMyRegistrationsForOccurrences[\s\S]*?\n}\n/);
  assert.ok(fnMatch, "Expected getMyRegistrationsForOccurrences to be defined");
  assert.match(fnMatch![0], /\.in\(\s*["']occurrence_id["']\s*,\s*occurrenceIds\s*\)/, "Must fetch all occurrences' registrations in a single .in() query");

  assert.doesNotMatch(source, /getMyRegistrationForOccurrence\b/, "The old per-occurrence function should be fully removed, not left as dead code alongside its batched replacement");
});

test("the member Experience detail page uses the batched registrations lookup, not a per-occurrence loop", () => {
  const pagePath = path.join(REPO_ROOT, "app", "experiences", "[experienceId]", "page.tsx");
  const source = readFileSync(pagePath, "utf8");
  assert.match(source, /getMyRegistrationsForOccurrences\(/);
  assert.doesNotMatch(source, /occurrences\.map\(\s*\(?o\)?\s*=>\s*getMyRegistrationForOccurrence/, "Must not reintroduce a per-occurrence Promise.all loop");
});
