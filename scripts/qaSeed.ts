// Guarded QA identity/data provisioning script -- NOT for production data, NOT run automatically.
//
// Target: the SHARED PRE-LAUNCH DEVELOPMENT AND QA DATABASE (the one Supabase project the
// `Production` branch's deployed Preview and `main` currently both point at -- there is no
// separate isolated QA project). This is an explicit, accepted decision for the pre-launch
// period, made because the project has no real users/churches/financial records yet. This
// script must never be pointed at anything described as "isolated QA" or "the final live
// database" without the guard values below being re-confirmed for that target.
//
// See scripts/qaCleanup.ts for the companion guarded removal script (dry-run only until
// explicitly run with --execute after testing completes, per docs/QA_SHARED_DATABASE.md).
//
// Creates five synthetic, login-capable QA accounts (Church A Host/Member, Church B Host/Member,
// Platform Administrator) plus the two QA churches and a baseline wallet state, using the app's
// own real Auth + RPC architecture (never a hand-rolled substitute for it):
//   - auth.users rows via supabase.auth.admin.createUser() (service-role only)
//   - public.profiles rows via the existing on_auth_user_created trigger (never inserted directly)
//   - churches + host membership via the existing create_church_with_host RPC, called while
//     authenticated AS that QA host (service-role has no auth.uid(), so this RPC cannot be called
//     with the admin client -- see "signInAs" below)
//   - member church_memberships rows via the same insert shape services/supabase/churches.ts's
//     joinChurchAsMember() uses (self, role: "member" -- matches church_memberships_insert_self_member_only)
//   - wallets via the existing lazy create_member_wallet()/create_church_wallet() RPCs, and a
//     starting balance via grant_credits() (platform-admin-gated, called authenticated as the QA
//     platform admin)
//
// Scope of this first pass (Step 6 of the requesting task is much larger): five users, two
// isolated churches, host/member/platform-admin roles, and a baseline wallet state (one member at
// zero credits, one member with a sufficient-credit grant, one church wallet funded, one at zero).
// Lessons/journeys/experiences/testimonies/progression synthetic-data matrices are NOT yet
// implemented here -- see the "NOT YET IMPLEMENTED" summary this script prints, and treat that as
// a separate follow-up rather than assuming this script produced them.
//
// Safety, all fail-closed:
//   - Refuses to run unless ALLOW_QA_SEED=true, QA_ENVIRONMENT=deployed-qa, and
//     QA_SUPABASE_PROJECT_REF exactly matches the project ref embedded in NEXT_PUBLIC_SUPABASE_URL.
//   - Refuses any email not matching qa.<label>@<QA_EMAIL_DOMAIN>.
//   - Defaults to --dry-run (read-only: looks up existing users/rows, prints the plan, mutates
//     nothing). Only --execute (plus the guards above) performs any write.
//   - Never logs a password, access token, cookie, or the service-role key. Auth user ids are
//     only printed if QA_PRINT_IDS=true (off by default) since they're not secret but also not
//     needed for ordinary use.
//   - Idempotent: reruns reuse existing QA auth users/churches/memberships/wallets by looking them
//     up first, never creating duplicates. Existing passwords are left untouched on reuse.
//
// Usage:
//   npx tsx scripts/qaSeed.ts --dry-run     (default; safe against any configured project)
//   npx tsx scripts/qaSeed.ts --execute     (mutates the approved QA project only)
//
// Required local secrets file: .env.qa.local (gitignored -- see .env.qa.example for the template).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Deliberately a *different* file from .env.local, so a developer's ordinary local dev
// credentials are never accidentally treated as the approved QA project.
loadEnvFile(".env.qa.local");

const DRY_RUN = !process.argv.includes("--execute");
const PRINT_IDS = process.env.QA_PRINT_IDS === "true";

// ---------------------------------------------------------------------------
// Guards -- every one of these must pass before any network call is made in --execute mode.
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`\n[qaSeed] REFUSING TO RUN: ${message}\n`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const approvedProjectRef = process.env.QA_SUPABASE_PROJECT_REF;
const qaEnvironment = process.env.QA_ENVIRONMENT;
const qaEmailDomain = process.env.QA_EMAIL_DOMAIN;
const allowQaSeed = process.env.ALLOW_QA_SEED;

if (!url || !serviceRoleKey || !publishableKey) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
      "must all be set in .env.qa.local (copy .env.qa.example and fill in the approved QA project's values)."
  );
}

const projectRefMatch = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
if (!projectRefMatch) {
  fail(`NEXT_PUBLIC_SUPABASE_URL ("${url}") doesn't look like a standard https://<ref>.supabase.co URL.`);
}
const actualProjectRef = projectRefMatch[1];

if (!approvedProjectRef) {
  fail(
    "QA_SUPABASE_PROJECT_REF is not set. Set it explicitly to the QA project's ref " +
      `(the value looks like it should be "${actualProjectRef}" for the currently-configured URL) so this ` +
      "script can refuse to run against any other project by accident."
  );
}
if (approvedProjectRef !== actualProjectRef) {
  fail(
    `QA_SUPABASE_PROJECT_REF ("${approvedProjectRef}") does not match the project ref embedded in ` +
      `NEXT_PUBLIC_SUPABASE_URL ("${actualProjectRef}"). Refusing to operate against an unapproved project.`
  );
}

// "shared-prelaunch-dev-qa" is a deliberate, explicit classification -- never "isolated-qa" or
// any value implying a dedicated project, since there isn't one. Changing what this value means
// is a decision for a human, not something this script should infer from context.
if (qaEnvironment !== "shared-prelaunch-dev-qa") {
  fail('QA_ENVIRONMENT must be exactly "shared-prelaunch-dev-qa". This script never assumes an environment classification.');
}

const APPROVED_QA_EMAIL_DOMAIN = "qa.quest4thekingdom.com";
if (qaEmailDomain !== APPROVED_QA_EMAIL_DOMAIN) {
  fail(`QA_EMAIL_DOMAIN must be exactly "${APPROVED_QA_EMAIL_DOMAIN}" (the one approved domain), not "${qaEmailDomain ?? "(unset)"}".`);
}

if (!DRY_RUN && allowQaSeed !== "true") {
  fail("ALLOW_QA_SEED must be exactly \"true\" to run in --execute mode. (--dry-run does not require it.)");
}

// ---------------------------------------------------------------------------
// QA identity roster
// ---------------------------------------------------------------------------

type QaAccountType = "host" | "member";

interface QaIdentity {
  key: string; // stable identifier, used for idempotent lookups/labels -- never a secret
  label: string; // safe, human-readable label for reports (no PII, since none of this is real)
  email: string;
  accountType: QaAccountType;
  passwordEnvVar: string;
  isPlatformAdmin: boolean;
  church: "A" | "B" | null;
}

const email = (localPart: string) => `qa.${localPart}@${qaEmailDomain}`;

const IDENTITIES: QaIdentity[] = [
  {
    key: "church-a-host",
    label: "Church A Host",
    email: email("church-a-host"),
    accountType: "host",
    passwordEnvVar: "QA_CHURCH_A_HOST_PASSWORD",
    isPlatformAdmin: false,
    church: "A",
  },
  {
    key: "church-a-member",
    label: "Church A Member",
    email: email("church-a-member"),
    accountType: "member",
    passwordEnvVar: "QA_CHURCH_A_MEMBER_PASSWORD",
    isPlatformAdmin: false,
    church: "A",
  },
  {
    key: "church-b-host",
    label: "Church B Host",
    email: email("church-b-host"),
    accountType: "host",
    passwordEnvVar: "QA_CHURCH_B_HOST_PASSWORD",
    isPlatformAdmin: false,
    church: "B",
  },
  {
    key: "church-b-member",
    label: "Church B Member",
    email: email("church-b-member"),
    accountType: "member",
    passwordEnvVar: "QA_CHURCH_B_MEMBER_PASSWORD",
    isPlatformAdmin: false,
    church: "B",
  },
  {
    key: "platform-admin",
    label: "Platform Administrator",
    email: email("platform-admin"),
    accountType: "member",
    passwordEnvVar: "QA_PLATFORM_ADMIN_PASSWORD",
    isPlatformAdmin: true,
    church: null,
  },
];

const QA_EMAIL_PATTERN = new RegExp(`^qa\\.[a-z0-9-]+@${qaEmailDomain.replace(/\./g, "\\.")}$`);
for (const id of IDENTITIES) {
  if (!QA_EMAIL_PATTERN.test(id.email)) {
    fail(`Generated email "${id.email}" does not match the approved synthetic pattern qa.<label>@${qaEmailDomain}.`);
  }
}

if (!DRY_RUN) {
  for (const id of IDENTITIES) {
    if (!process.env[id.passwordEnvVar]) {
      fail(`${id.passwordEnvVar} is not set in .env.qa.local. All five QA passwords are required before --execute.`);
    }
  }
}

const CHURCH_NAMES = {
  A: "Quest for the Kingdom QA -- Church A",
  B: "Quest for the Kingdom QA -- Church B",
} as const;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const admin: SupabaseClient = createSupabaseClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A fresh, unauthenticated client per sign-in so sessions never bleed between QA identities.
function anonClient(): SupabaseClient {
  return createSupabaseClient(url!, publishableKey!, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signInAs(id: QaIdentity): Promise<SupabaseClient> {
  const client = anonClient();
  const password = process.env[id.passwordEnvVar]!;
  const { error } = await client.auth.signInWithPassword({ email: id.email, password });
  if (error) throw new Error(`Sign-in failed for ${id.label}: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// Auth user create-or-reuse (admin API only; never a direct profiles insert as a substitute)
// ---------------------------------------------------------------------------

interface AuthUserSummary {
  id: string;
  email: string;
  userMetadata: Record<string, unknown>;
}

let cachedAllUsers: AuthUserSummary[] | null = null;

// supabase-js's admin.listUsers() has no server-side email filter in all SDK versions -- fetch
// once, cache for the rest of the run. Also doubles as the "confirm no unexpected real users"
// read: see auditNonQaIdentities() below.
async function listAllUsersCached(): Promise<AuthUserSummary[]> {
  if (cachedAllUsers) return cachedAllUsers;
  const all: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      all.push({ id: u.id, email: u.email ?? "", userMetadata: u.user_metadata ?? {} });
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  cachedAllUsers = all;
  return all;
}

async function findExistingUserByEmail(targetEmail: string): Promise<AuthUserSummary | null> {
  const all = await listAllUsersCached();
  return all.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase()) ?? null;
}

// "Fail closed if unexpected existing records or identity collisions are found": an auth user
// already sitting at one of the five approved QA emails that this script did NOT create (no
// qa_seed/qa_label markers matching this identity) is refused rather than silently reused or
// overwritten -- it might be a real account that happens to share the address, or QA data seeded
// by a different, incompatible process.
function assertNoIdentityCollision(id: QaIdentity, existing: AuthUserSummary) {
  const isKnownQaUser = existing.userMetadata.qa_seed === true && existing.userMetadata.qa_label === id.key;
  if (!isKnownQaUser) {
    fail(
      `Identity collision: an auth user already exists at ${id.email} that was NOT created by this script ` +
        `(missing/mismatched qa_seed/qa_label metadata). Refusing to reuse or modify it. Investigate manually ` +
        `before proceeding -- this could be a real account or QA data from an incompatible source.`
    );
  }
}

// Read-only check supporting "confirm there are currently no real Auth users" -- reports any auth
// user whose email is not on the approved QA domain. Informational only: never acts on these.
async function auditNonQaIdentities(): Promise<{ total: number; nonQaCount: number; nonQaEmailsRedacted: string[] }> {
  const all = await listAllUsersCached();
  const nonQa = all.filter((u) => !QA_EMAIL_PATTERN.test(u.email));
  return {
    total: all.length,
    nonQaCount: nonQa.length,
    // Redact the local part so this is safe to paste into a report -- domain only, e.g. "***@gmail.com".
    nonQaEmailsRedacted: nonQa.map((u) => `***@${u.email.split("@")[1] ?? "(unknown)"}`),
  };
}

// Read-only check supporting "confirm migrations 0001-0035 are already applied": every table this
// script needs to read or write should already exist with the expected shape. A missing table
// surfaces here as a clear, itemized report instead of a confusing failure deep inside a later
// RPC call.
const REQUIRED_TABLES = [
  "profiles",
  "churches",
  "church_memberships",
  "member_wallets",
  "church_wallets",
  "credit_ledger_entries",
] as const;

async function checkRequiredTablesExist(): Promise<{ table: string; ok: boolean; error?: string }[]> {
  const results: { table: string; ok: boolean; error?: string }[] = [];
  for (const table of REQUIRED_TABLES) {
    const { error } = await admin.from(table).select("*", { count: "exact", head: true });
    results.push({ table, ok: !error, error: error?.message });
  }
  return results;
}

interface IdentityResult {
  label: string;
  email: string;
  authUser: "created" | "reused" | "would-create" | "would-reuse";
  profile: "created" | "reused" | "missing" | "would-create-via-trigger";
  role: string;
  church: string;
  onboarding: string;
  wallet: string;
  failure?: string;
}

async function provisionIdentity(id: QaIdentity): Promise<{ result: IdentityResult; profileId: string | null }> {
  const existing = await findExistingUserByEmail(id.email);
  // Checked in both dry-run and execute -- an identity collision is worth surfacing as early as
  // possible, and this check is read-only either way.
  if (existing) assertNoIdentityCollision(id, existing);

  if (DRY_RUN) {
    return {
      profileId: existing?.id ?? null,
      result: {
        label: id.label,
        email: id.email,
        authUser: existing ? "would-reuse" : "would-create",
        profile: existing ? "reused" : "would-create-via-trigger",
        role: id.isPlatformAdmin ? "platform-admin" : id.accountType,
        church: id.church ? `Church ${id.church}` : "(none)",
        onboarding: id.accountType === "host" ? "would create/verify church" : "would join church",
        wallet: "would lazily create wallet",
      },
    };
  }

  let profileId: string;
  let authUserOutcome: IdentityResult["authUser"];
  let profileOutcome: IdentityResult["profile"];

  if (existing) {
    profileId = existing.id;
    authUserOutcome = "reused";
    // Guarantee confirmed state on rerun without touching the password.
    const { error } = await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    if (error) throw new Error(`updateUserById(email_confirm) failed for ${id.label}: ${error.message}`);
    profileOutcome = "reused";
  } else {
    const password = process.env[id.passwordEnvVar]!;
    const { data, error } = await admin.auth.admin.createUser({
      email: id.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `[QA] ${id.label}`,
        account_type: id.accountType,
        qa_seed: true,
        qa_label: id.key,
      },
    });
    if (error || !data.user) throw new Error(`createUser failed for ${id.label}: ${error?.message ?? "no user returned"}`);
    profileId = data.user.id;
    authUserOutcome = "created";
    profileOutcome = "created";
  }

  // Verify the on_auth_user_created trigger actually produced the profiles row -- never insert
  // one directly as a substitute if it didn't.
  const { data: profileRow, error: profileError } = await admin.from("profiles").select("id").eq("id", profileId).maybeSingle();
  if (profileError) throw new Error(`profiles lookup failed for ${id.label}: ${profileError.message}`);
  if (!profileRow) {
    return {
      profileId,
      result: {
        label: id.label,
        email: id.email,
        authUser: authUserOutcome,
        profile: "missing",
        role: "-",
        church: "-",
        onboarding: "-",
        wallet: "-",
        failure: "profiles row was not created by on_auth_user_created -- investigate before continuing (do not hand-insert a substitute row).",
      },
    };
  }

  if (id.isPlatformAdmin) {
    const { error } = await admin.from("profiles").update({ is_platform_admin: true }).eq("id", profileId);
    if (error) throw new Error(`Failed to set is_platform_admin for ${id.label}: ${error.message}`);
  }

  return {
    profileId,
    result: {
      label: id.label,
      email: id.email,
      authUser: authUserOutcome,
      profile: profileOutcome,
      role: id.isPlatformAdmin ? "platform-admin" : id.accountType,
      church: id.church ? `Church ${id.church}` : "(none)",
      onboarding: "pending", // filled in by provisionChurchesAndRoles / provisionWallets below
      wallet: "pending",
    },
  };
}

// ---------------------------------------------------------------------------
// Churches + memberships (Step 5) -- via the app's own RPCs/insert shape, never a raw substitute.
// ---------------------------------------------------------------------------

interface ChurchRow {
  id: string;
  name: string;
  is_demo: boolean;
  created_by: string | null;
}

type ChurchResolution =
  | { kind: "reuse"; church: ChurchRow }
  | { kind: "create" }
  | { kind: "host-missing" };

// Hardened reuse check: a match requires BOTH the collision-verified QA host's own host/admin
// membership AND the exact stable synthetic church name expected for that host to agree on the
// same row. `churches.name` has no unique constraint in the schema (only `slug` does), so two
// independently-created churches could otherwise share a name -- and a host could in principle
// hold a membership to some other church entirely. Every disagreement between those two signals,
// or any sign of more than one candidate, fails closed rather than guessing.
async function resolveChurchForHost(hostId: QaIdentity, churchLabel: "A" | "B"): Promise<ChurchResolution> {
  const expectedName = CHURCH_NAMES[churchLabel];

  const existingHost = await findExistingUserByEmail(hostId.email);
  if (!existingHost) return { kind: "host-missing" };

  const { data: nameMatches, error: nameLookupError } = await admin
    .from("churches")
    .select("id, name, is_demo, created_by")
    .eq("name", expectedName);
  if (nameLookupError) throw new Error(`churches name lookup failed: ${nameLookupError.message}`);
  if ((nameMatches ?? []).length > 1) {
    fail(
      `Found ${nameMatches!.length} churches named exactly "${expectedName}" -- expected at most one ` +
        `(duplicate QA church). Refusing to guess which is the real one. Investigate manually before continuing.`
    );
  }
  const nameMatch = (nameMatches?.[0] as ChurchRow | undefined) ?? null;

  const { data: memberships, error: membershipLookupError } = await admin
    .from("church_memberships")
    .select("church_id")
    .eq("profile_id", existingHost.id)
    .in("role", ["host", "admin"]);
  if (membershipLookupError) throw new Error(`church_memberships lookup failed: ${membershipLookupError.message}`);
  if ((memberships ?? []).length > 1) {
    fail(
      `${hostId.label} (${hostId.email}) holds more than one host/admin church_memberships row -- expected ` +
        `at most one, since create_church_with_host enforces one church per host. Refusing to guess which is ` +
        `the QA church. Investigate manually before continuing.`
    );
  }
  const membershipChurchId = memberships?.[0]?.church_id ?? null;

  if (!membershipChurchId && !nameMatch) {
    return { kind: "create" };
  }
  if (membershipChurchId && !nameMatch) {
    fail(
      `${hostId.label} manages a church (id ${membershipChurchId}) but no church is named exactly ` +
        `"${expectedName}" -- mismatched church. Refusing to reuse it. Investigate manually before continuing.`
    );
  }
  if (!membershipChurchId && nameMatch) {
    fail(
      `A church named exactly "${expectedName}" already exists (id ${nameMatch.id}), but ${hostId.label} does ` +
        `not manage it (no host/admin membership) -- unexpected/non-QA record. Refusing to touch it. ` +
        `Investigate manually before continuing.`
    );
  }
  if (nameMatch!.id !== membershipChurchId) {
    fail(
      `${hostId.label}'s managed church (id ${membershipChurchId}) is not the same row as the church named ` +
        `"${expectedName}" (id ${nameMatch!.id}) -- unexpected church. Refusing to guess which is correct. ` +
        `Investigate manually before continuing.`
    );
  }
  if (nameMatch!.created_by !== existingHost.id) {
    fail(
      `Church "${expectedName}" (id ${nameMatch!.id}) was created_by a different profile than ${hostId.label} ` +
        `-- non-QA/unexpected record. Refusing to touch it. Investigate manually before continuing.`
    );
  }

  return { kind: "reuse", church: nameMatch! };
}

async function provisionChurchForHost(hostId: QaIdentity, churchLabel: "A" | "B"): Promise<{ churchId: string | null; note: string }> {
  const expectedName = CHURCH_NAMES[churchLabel];
  const resolution = await resolveChurchForHost(hostId, churchLabel);

  if (resolution.kind === "host-missing") {
    return { churchId: null, note: "host auth user missing -- cannot provision church" };
  }

  if (resolution.kind === "reuse") {
    if (DRY_RUN) {
      return { churchId: resolution.church.id, note: `would reuse "${expectedName}" (verified: host identity + exact name match)` };
    }
    // Re-assert is_demo=true (idempotent, narrowly scoped to this exact, now-verified id) -- self-
    // heals a rerun that crashed between create_church_with_host and this flag being set the first time.
    await admin.from("churches").update({ is_demo: true }).eq("id", resolution.church.id);
    return { churchId: resolution.church.id, note: "reused existing church (verified by host identity + exact name match)" };
  }

  // resolution.kind === "create"
  if (DRY_RUN) return { churchId: null, note: `would create "${expectedName}" via create_church_with_host` };

  const client = await signInAs(hostId);
  const { data, error } = await client.rpc("create_church_with_host", {
    p_name: expectedName,
    p_city: "QA City",
    p_region: "QA",
    p_country: "US",
  });
  await client.auth.signOut();
  if (error || !data) throw new Error(`create_church_with_host failed for ${hostId.label}: ${error?.message ?? "no church returned"}`);

  // create_church_with_host always inserts is_demo=false -- flip it via the admin client,
  // narrowly scoped to exactly this church's id.
  await admin.from("churches").update({ is_demo: true }).eq("id", (data as { id: string }).id);

  return { churchId: (data as { id: string }).id, note: "created new church" };
}

async function joinChurchAsQaMember(memberId: QaIdentity, churchId: string): Promise<string> {
  if (DRY_RUN) return "would join via self-service church_memberships insert (role=member)";

  const client = await signInAs(memberId);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error(`No session after sign-in for ${memberId.label}`);

  const { error } = await client.from("church_memberships").insert({ church_id: churchId, profile_id: user.id, role: "member" });
  await client.auth.signOut();
  // 23505 = unique_violation on (church_id, profile_id) -- already joined, harmless on rerun.
  if (error && error.code !== "23505") throw new Error(`church join failed for ${memberId.label}: ${error.message}`);
  return error ? "already a member (reused)" : "joined";
}

// ---------------------------------------------------------------------------
// Baseline wallet state (partial Step 6 -- see the NOT YET IMPLEMENTED summary at the end)
// ---------------------------------------------------------------------------

async function provisionMemberWallet(memberId: QaIdentity, grantCredits: number | null): Promise<string> {
  if (DRY_RUN) return grantCredits ? `would create wallet + grant ${grantCredits} credits` : "would create wallet (zero balance)";

  const client = await signInAs(memberId);
  const { data: wallet, error } = await client.rpc("create_member_wallet");
  await client.auth.signOut();
  if (error || !wallet) throw new Error(`create_member_wallet failed for ${memberId.label}: ${error?.message ?? "no wallet returned"}`);

  if (!grantCredits) return "wallet ready (zero balance)";

  const adminIdentity = IDENTITIES.find((i) => i.isPlatformAdmin)!;
  const adminClient = await signInAs(adminIdentity);
  const { error: grantError } = await adminClient.rpc("grant_credits", {
    p_target_member_id: (wallet as { profile_id: string }).profile_id,
    p_target_church_id: null,
    p_amount: grantCredits,
    p_transaction_type: "platform_grant",
    p_description: "QA seed: baseline balance",
    p_idempotency_key: `qa-seed:member-wallet:${memberId.key}`,
    p_metadata: { qa_seed: true },
  });
  await adminClient.auth.signOut();
  // Idempotency key collision on rerun is expected and safe -- surface anything else.
  if (grantError && !/idempotency/i.test(grantError.message)) {
    throw new Error(`grant_credits failed for ${memberId.label}: ${grantError.message}`);
  }
  return `wallet ready (granted ${grantCredits} credits)`;
}

async function provisionChurchWallet(hostId: QaIdentity, churchId: string, grantCredits: number | null): Promise<string> {
  if (DRY_RUN) return grantCredits ? `would create church wallet + grant ${grantCredits} credits` : "would create church wallet (zero balance)";

  const client = await signInAs(hostId);
  const { data: wallet, error } = await client.rpc("create_church_wallet", { p_church_id: churchId });
  await client.auth.signOut();
  if (error || !wallet) throw new Error(`create_church_wallet failed for ${hostId.label}: ${error?.message ?? "no wallet returned"}`);

  if (!grantCredits) return "church wallet ready (zero balance)";

  const adminIdentity = IDENTITIES.find((i) => i.isPlatformAdmin)!;
  const adminClient = await signInAs(adminIdentity);
  const { error: grantError } = await adminClient.rpc("grant_credits", {
    p_target_member_id: null,
    p_target_church_id: churchId,
    p_amount: grantCredits,
    p_transaction_type: "platform_grant",
    p_description: "QA seed: baseline church balance",
    p_idempotency_key: `qa-seed:church-wallet:${churchId}`,
    p_metadata: { qa_seed: true },
  });
  await adminClient.auth.signOut();
  if (grantError && !/idempotency/i.test(grantError.message)) {
    throw new Error(`grant_credits failed for church ${churchId}: ${grantError.message}`);
  }
  return `church wallet ready (granted ${grantCredits} credits)`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n[qaSeed] mode: ${DRY_RUN ? "DRY RUN (read-only)" : "EXECUTE (will write)"}`);
  console.log(`[qaSeed] target project ref: ${actualProjectRef}`);
  console.log(`[qaSeed] environment classification: shared pre-launch development and QA database`);
  console.log(`[qaSeed] QA_ENVIRONMENT: ${qaEnvironment}`);
  console.log(`[qaSeed] QA_EMAIL_DOMAIN: ${qaEmailDomain}\n`);

  console.log("[qaSeed] Required-table check (supports confirming migrations 0001-0035 are applied):");
  const tableChecks = await checkRequiredTablesExist();
  for (const t of tableChecks) {
    console.log(`  ${t.ok ? "OK  " : "MISSING"} ${t.table}${t.error ? ` -- ${t.error}` : ""}`);
  }
  if (tableChecks.some((t) => !t.ok)) {
    fail("One or more required tables are missing or unreadable -- migrations 0001-0035 may not be fully applied to this project. Fix before continuing.");
  }
  console.log("");

  console.log("[qaSeed] Existing Auth user audit (supports confirming there are no real users yet):");
  const audit = await auditNonQaIdentities();
  console.log(`  total auth users in this project: ${audit.total}`);
  console.log(`  users on the approved QA domain:   ${audit.total - audit.nonQaCount}`);
  console.log(`  users on OTHER domains:            ${audit.nonQaCount}${audit.nonQaCount > 0 ? ` (domains only, redacted: ${audit.nonQaEmailsRedacted.join(", ")})` : ""}`);
  if (audit.nonQaCount > 0) {
    console.log("  NOTE: non-QA-domain users exist in this project. This script never touches them, but you");
    console.log("  should confirm none of them are real accounts before proceeding, per your own review process.");
  }
  console.log("");

  const results: IdentityResult[] = [];
  const profileIds = new Map<string, string | null>();

  for (const id of IDENTITIES) {
    const { result, profileId } = await provisionIdentity(id);
    results.push(result);
    profileIds.set(id.key, profileId);
  }

  const churchAHost = IDENTITIES.find((i) => i.key === "church-a-host")!;
  const churchBHost = IDENTITIES.find((i) => i.key === "church-b-host")!;
  const churchAMember = IDENTITIES.find((i) => i.key === "church-a-member")!;
  const churchBMember = IDENTITIES.find((i) => i.key === "church-b-member")!;

  const churchA = await provisionChurchForHost(churchAHost, "A");
  const churchB = await provisionChurchForHost(churchBHost, "B");

  const findResult = (key: string) => results.find((r) => r.email === IDENTITIES.find((i) => i.key === key)!.email)!;

  findResult("church-a-host").onboarding = churchA.note;
  findResult("church-b-host").onboarding = churchB.note;

  if (churchA.churchId) {
    findResult("church-a-member").onboarding = await joinChurchAsQaMember(churchAMember, churchA.churchId);
  }
  if (churchB.churchId) {
    findResult("church-b-member").onboarding = await joinChurchAsQaMember(churchBMember, churchB.churchId);
  }
  findResult("platform-admin").onboarding = "n/a (no church)";

  // Baseline wallet state: Church A Member = sufficient-credit grant, Church B Member = zero
  // balance (wallet exists, untouched). Church A's church wallet funded so it can approve a
  // request; Church B's church wallet left at zero (insufficient-church-balance state).
  findResult("church-a-member").wallet = await provisionMemberWallet(churchAMember, 500);
  findResult("church-b-member").wallet = await provisionMemberWallet(churchBMember, null);
  if (churchA.churchId) {
    findResult("church-a-host").wallet = await provisionChurchWallet(churchAHost, churchA.churchId, 1000);
  }
  if (churchB.churchId) {
    findResult("church-b-host").wallet = await provisionChurchWallet(churchBHost, churchB.churchId, null);
  }
  findResult("platform-admin").wallet = "n/a (platform admin has no member wallet requirement)";

  // --- sanitized summary ---
  console.log("[qaSeed] Summary:\n");
  for (const r of results) {
    console.log(`  ${r.label}`);
    console.log(`    email:        ${r.email}`);
    console.log(`    auth user:    ${r.authUser}`);
    console.log(`    profile:      ${r.profile}`);
    console.log(`    role:         ${r.role}`);
    console.log(`    church:       ${r.church}`);
    console.log(`    onboarding:   ${r.onboarding}`);
    console.log(`    wallet:       ${r.wallet}`);
    if (r.failure) console.log(`    FAILURE:      ${r.failure}`);
    if (PRINT_IDS) console.log(`    profile id:   ${profileIds.get(IDENTITIES.find((i) => i.email === r.email)!.key) ?? "(n/a in dry run)"}`);
    console.log("");
  }

  console.log("[qaSeed] NOT YET IMPLEMENTED by this script (separate follow-up recommended):");
  console.log("  - Insufficient-credit member state (needs a real Experience credit_cost to compare against)");
  console.log("  - Lessons: draft/published, and journeys: no-journey/in-progress/completed/duplicate-completion states");
  console.log("  - Experiences: free/paid/default-price/override-price, occurrence available/full/waitlist, registration confirmed/refundable/nonrefundable");
  console.log("  - Progression: existing Points/XP state, level-threshold state, badge earned/unearned, leaderboard opt-out (no admin RPC exists for this -- only real activity triggers award_progression_event)");
  console.log("  - Testimony submission/review states, Kingdom Scroll states, reward-history/duplicate-reward states\n");

  const anyFailure = results.some((r) => r.failure);
  if (anyFailure) {
    console.error("[qaSeed] One or more identities failed -- see FAILURE lines above.");
    process.exit(1);
  }

  console.log(DRY_RUN ? "[qaSeed] Dry run complete. No writes were made. Re-run with --execute to provision." : "[qaSeed] Provisioning complete.");
}

main().catch((err) => {
  console.error(`\n[qaSeed] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
