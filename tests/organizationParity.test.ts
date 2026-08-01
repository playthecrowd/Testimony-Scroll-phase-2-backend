import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { isEntityManagerAccountType } from "../lib/accountType";
import { entityLabel } from "../lib/entityLabel";
import { getSidebarLinks, SIDEBAR_MEMBER_LINKS } from "../lib/navigation";

// Phase 10D1: Organization account/entity parity. Covers the three account-entry choices, the
// shared entity_type structure, dynamic labeling, and -- most importantly -- a regression net
// confirming every one of the 17 previously binary accountType === "host" checks documented in
// the Phase 10D1 audit was actually migrated to the shared isEntityManagerAccountType helper, not
// just some of them.

const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

// ---------------------------------------------------------------------------
// [TRUE TEST] isEntityManagerAccountType
// ---------------------------------------------------------------------------

test("[TRUE TEST] isEntityManagerAccountType is true for host and organization, false for member", () => {
  assert.equal(isEntityManagerAccountType("host"), true);
  assert.equal(isEntityManagerAccountType("organization"), true);
  assert.equal(isEntityManagerAccountType("member"), false);
});

// ---------------------------------------------------------------------------
// [TRUE TEST] entityLabel
// ---------------------------------------------------------------------------

test("[TRUE TEST] entityLabel returns distinct, correctly-worded strings per entity type", () => {
  assert.equal(entityLabel("church", "dashboard"), "Church Dashboard");
  assert.equal(entityLabel("organization", "dashboard"), "Organization Dashboard");
  assert.equal(entityLabel("church", "profile"), "Church Profile");
  assert.equal(entityLabel("organization", "profile"), "Organization Profile");
  assert.equal(entityLabel("church", "nameField"), "Church Name");
  assert.equal(entityLabel("organization", "nameField"), "Organization Name");
  assert.equal(entityLabel("church", "members"), "Church Members");
  assert.equal(entityLabel("organization", "members"), "Organization Members");
});

test("[TRUE TEST] entityLabel never returns the same string for church vs organization on any key", () => {
  const keys = ["entityName", "nameField", "dashboard", "profile", "members", "experiences", "lessons", "manager", "createButton", "typeField"] as const;
  for (const key of keys) {
    assert.notEqual(entityLabel("church", key), entityLabel("organization", key), `key "${key}" should differ between entity types`);
  }
});

// ---------------------------------------------------------------------------
// [TRUE TEST] getSidebarLinks -- dashboard routing per account type
// ---------------------------------------------------------------------------

test("[TRUE TEST] getSidebarLinks routes Member accounts to the member link set, unchanged", () => {
  const links = getSidebarLinks("member");
  assert.deepEqual(links, SIDEBAR_MEMBER_LINKS);
});

test("[TRUE TEST] getSidebarLinks gives Church accounts a 'Church Dashboard' labeled /host-dashboard entry", () => {
  const links = getSidebarLinks("host");
  const dashboardLink = links.find((l) => l.href === "/host-dashboard");
  assert.ok(dashboardLink, "expected a /host-dashboard entry for a host account");
  assert.equal(dashboardLink!.label, "Church Dashboard");
});

test("[TRUE TEST] getSidebarLinks gives Organization accounts an 'Organization Dashboard' labeled /host-dashboard entry -- same route, different label", () => {
  const links = getSidebarLinks("organization");
  const dashboardLink = links.find((l) => l.href === "/host-dashboard");
  assert.ok(dashboardLink, "expected a /host-dashboard entry for an organization account");
  assert.equal(dashboardLink!.label, "Organization Dashboard");
});

test("[TRUE TEST] getSidebarLinks does not duplicate routes between Church and Organization -- same underlying dashboard is reused, not a separate implementation", () => {
  const hostLinks = getSidebarLinks("host");
  const orgLinks = getSidebarLinks("organization");
  assert.deepEqual(hostLinks.map((l) => l.href), orgLinks.map((l) => l.href));
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] Migration: entity_type, account_type, and the generalized creation RPC
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] migration adds churches.entity_type with a church/organization check constraint, defaulting existing rows to 'church'", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /add column entity_type text not null default 'church'/);
  assert.match(sql, /check \(entity_type in \('church', 'organization'\)\)/);
});

test("[SOURCE SCAN] migration widens profiles.account_type to accept 'organization' without removing 'host'/'member'", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /check \(account_type in \('host', 'member', 'organization'\)\)/);
});

test("[SOURCE SCAN] create_church_with_host is dropped and recreated with a defaulted p_entity_type param -- old 4-arg callers keep working unchanged", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /drop function if exists public\.create_church_with_host\(text, text, text, text\)/);
  assert.match(sql, /p_entity_type text default 'church'/);
});

test("[SOURCE SCAN] create_church_with_host cross-validates the requested entity type against the caller's real account_type -- selecting a card never grants creation rights on its own", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /Only Organization accounts can create an organization\./);
  assert.match(sql, /Only Church Host accounts can create a church\./);
  assert.match(sql, /v_required_account_type := case when p_entity_type = 'organization' then 'organization' else 'host' end/);
});

test("[SOURCE SCAN] create_church_with_host still creates exactly one church_memberships row with role 'host', regardless of entity type -- membership creation is unchanged by this migration", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /insert into public\.church_memberships \(church_id, profile_id, role\)\s*\n\s*values \(v_church\.id, auth\.uid\(\), 'host'\);/);
});

test("[SOURCE SCAN] the migration adds zero new RLS policies -- private.is_church_manager and every policy built on it key only off church_id/id, so no policy needs to know about entity_type", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.doesNotMatch(sql, /create policy/i);
});

test("[SOURCE SCAN] entity_type is never added to the client-writable column grant in this migration or any earlier one -- it can only be set at creation time by the RPC", () => {
  const migrationsDir = path.join(REPO_ROOT, "supabase", "migrations");
  const files = readdirSync(migrationsDir).filter((f: string) => f.endsWith(".sql"));
  for (const file of files) {
    const sql = read(`supabase/migrations/${file}`);
    const grantBlocks = sql.match(/grant update\s*\([^)]*\)\s*on public\.churches/gi) ?? [];
    for (const block of grantBlocks) {
      assert.doesNotMatch(block, /entity_type/, `${file} must not grant column-level UPDATE on entity_type`);
    }
  }
});

test("[SOURCE SCAN] the migration is wrapped in an explicit transaction (begin ... commit) so a failure partway through can't leave the schema half-migrated", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /^begin;/m);
  assert.match(sql, /^commit;/m);
});

test("[SOURCE SCAN] the account_type check constraint is located dynamically via pg_constraint + `into strict`, never a hardcoded constraint name assumed to exist", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /select conname into strict v_constraint_name/);
  assert.match(sql, /from pg_constraint/);
  assert.match(sql, /contype = 'c'/);
  assert.match(sql, /execute format\('alter table public\.profiles drop constraint %I', v_constraint_name\)/);
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] entity_type protection -- Church/Organization managers cannot self-reclassify
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] protect_church_entity_type trigger exists, fires before update on churches, and blocks any entity_type change unless the caller is a platform admin", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.match(sql, /create or replace function public\.protect_church_entity_type\(\)/);
  assert.match(sql, /if new\.entity_type is distinct from old\.entity_type then/);
  assert.match(sql, /if not exists \(select 1 from public\.profiles where id = auth\.uid\(\) and is_platform_admin\) then/);
  assert.match(sql, /before update on public\.churches\s*\n\s*for each row execute function public\.protect_church_entity_type\(\);/);
});

test("[SOURCE SCAN] the entity_type protection trigger only inspects entity_type -- ordinary Church/Organization profile edits (name, description, address, etc.) are structurally unaffected by it", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  const fnBody = sql.match(/create or replace function public\.protect_church_entity_type\(\)[\s\S]*?\$\$;/);
  assert.ok(fnBody, "expected to find the protect_church_entity_type function body");
  // The only NEW./OLD. column comparison anywhere in the function body is entity_type -- no other
  // column name appears, so no other field can ever trip this trigger's exception.
  const columnComparisons = fnBody![0].match(/new\.\w+ is distinct from old\.\w+/g) ?? [];
  assert.deepEqual(columnComparisons, ["new.entity_type is distinct from old.entity_type"]);
});

test("[SOURCE SCAN] a Church manager (or Organization manager) is not a platform admin by default, so the trigger's is_platform_admin check is the only path that can ever let an entity_type change through -- confirms Church->Organization and Organization->Church self-reclassification are both blocked symmetrically, not just one direction", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  const fnBody = sql.match(/create or replace function public\.protect_church_entity_type\(\)[\s\S]*?\$\$;/)![0];
  // The guard doesn't branch on which direction the change goes (church->organization vs
  // organization->church) -- it's a single unconditional `is_platform_admin` check applied to any
  // change at all, so both directions are covered by construction, not by two separate checks that
  // could drift out of sync.
  assert.equal((fnBody.match(/raise exception/g) ?? []).length, 1);
});

test("[SOURCE SCAN] entity_type is never added to the client-writable column grant -- it can only be set at creation time by the RPC, never edited afterward", () => {
  const sql = read("supabase/migrations/0041_organization_entity_type.sql");
  assert.doesNotMatch(sql, /grant update[\s\S]*entity_type/);
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] Three account-entry choices on the shared auth screen
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] AuthScreen renders exactly three entry choices -- Member, Church, and Organization -- as a single shared entry point, not three separate auth flows", () => {
  const src = read("components/auth/AuthScreen.tsx");
  assert.match(src, /onClick=\{\(\) => setAccountType\("member"\)\}/);
  assert.match(src, /onClick=\{\(\) => setAccountType\("host"\)\}/);
  assert.match(src, /onClick=\{\(\) => setAccountType\("organization"\)\}/);
  assert.match(src, /Continue as Member/);
  assert.match(src, /Continue as Church/);
  assert.match(src, /Continue as Organization/);
  // Exactly one <form>, one useSession() call, one signIn/signUp pair -- confirms this is still
  // one shared authentication system, not three parallel ones bolted together.
  assert.equal((src.match(/<form/g) ?? []).length, 1);
  assert.equal((src.match(/useSession\(\)/g) ?? []).length, 1);
});

test("[SOURCE SCAN] the three entry choices render unconditionally, not gated to only the Create Account tab -- they sit above the single shared <form>, outside any tab === \"signup\" guard", () => {
  const src = read("components/auth/AuthScreen.tsx");
  const cardsIdx = src.indexOf('onClick={() => setAccountType("member")}');
  const formIdx = src.indexOf("<form onSubmit=");
  assert.ok(cardsIdx > -1 && formIdx > -1 && cardsIdx < formIdx, "entry cards must render before the shared form, outside any signup-only branch");
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] Signup intent mapping (Decision 3): host stays 'host', organization is new
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] Church signup intent still maps to the existing 'host' account_type -- confirmed unchanged, not silently renamed", () => {
  const authScreen = read("components/auth/AuthScreen.tsx");
  assert.match(authScreen, /useState<AccountType>\("member"\)/); // default unchanged
  const churchOnboarding = read("app/onboarding/church/page.tsx");
  assert.match(churchOnboarding, /if \(session\.accountType !== "host"\) \{/); // untouched by this phase
});

test("[SOURCE SCAN] Organization onboarding gates on account_type === 'organization', a sibling flow to Church onboarding, not a shared component with a label prop", () => {
  const orgOnboarding = read("app/onboarding/organization/page.tsx");
  assert.match(orgOnboarding, /if \(session\.accountType !== "organization"\) \{/);
  assert.match(orgOnboarding, /completeOrganizationSetup/);
});

test("[SOURCE SCAN] Organization onboarding's server action passes p_entity_type: \"organization\" to the shared creation RPC", () => {
  const actions = read("app/onboarding/organization/actions.ts");
  assert.match(actions, /p_entity_type: "organization"/);
  assert.match(actions, /create_church_with_host/);
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] Post-login routing (Member / Church / Organization dashboards)
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] resolvePostAuthDestination routes both host and organization intents to onboarding-or-dashboard, member falls through to /dashboard unchanged", () => {
  const src = read("services/authService.ts");
  assert.match(src, /profile\?\.account_type === "host" \|\| profile\?\.account_type === "organization"/);
  assert.match(src, /return profile\.account_type === "organization" \? "\/onboarding\/organization" : "\/onboarding\/church";/);
  assert.match(src, /return "\/dashboard";/);
});

test("[SOURCE SCAN] a churchless/orgless host or organization account is sent to onboarding, an entity manager is sent to the one shared /host-dashboard -- never a separate /organization-dashboard route", () => {
  const src = read("services/authService.ts");
  assert.match(src, /if \(count && count > 0\) return "\/host-dashboard";/);
  assert.doesNotMatch(src, /organization-dashboard/);
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] Regression net -- every former `accountType === "host"` gate site was migrated
// ---------------------------------------------------------------------------

// services/authService.ts and app/profile/page.tsx are deliberately excluded from this list: both
// legitimately need to distinguish all three account types inline (resolvePostAuthDestination
// routes host/organization to two different onboarding paths; ProfilePage's accountTypeLabel shows
// three different display labels) rather than collapsing to the shared manager/non-manager boolean
// -- each has its own dedicated correctness test below instead.
// components/layout/Sidebar.tsx is also excluded: it delegates entirely to lib/navigation.ts's
// getSidebarLinks (itself covered by the getSidebarLinks tests above and internally built on
// isEntityManagerAccountType), rather than importing the helper a second time redundantly.
const MIGRATED_GATE_FILES = [
  "components/layout/TopBar.tsx",
  "components/layout/AccountMenu.tsx",
  "app/host-dashboard/page.tsx",
  "app/host-dashboard/experiences/page.tsx",
  "app/experience-builder/page.tsx",
  "app/experience-builder/import/page.tsx",
  "app/experience-builder/ExperienceBuilderForm.tsx",
  "app/lessons/[lessonId]/LessonDetailClient.tsx",
];

test("[SOURCE SCAN] Sidebar.tsx delegates to getSidebarLinks instead of comparing accountType to \"host\" directly", () => {
  const src = read("components/layout/Sidebar.tsx");
  assert.match(src, /getSidebarLinks\(session\.accountType\)/);
  assert.doesNotMatch(src, /account[Tt]ype (===|!==) "host"/);
});

test("[SOURCE SCAN] every previously-binary host-only gate file now imports isEntityManagerAccountType", () => {
  for (const file of MIGRATED_GATE_FILES) {
    const src = read(file);
    assert.match(src, /isEntityManagerAccountType/, `${file} should reference the shared isEntityManagerAccountType helper`);
  }
});

test("[SOURCE SCAN] no migrated gate file still contains a raw accountType/account_type === \"host\" comparison -- Organization must never silently fall through to Member behavior", () => {
  for (const file of MIGRATED_GATE_FILES) {
    const src = read(file);
    assert.doesNotMatch(
      src,
      /account[Tt]ype (===|!==) "host"/,
      `${file} still contains a raw "host" comparison instead of isEntityManagerAccountType`
    );
  }
});

test("[SOURCE SCAN] ProfilePage's accountTypeLabel explicitly branches on all three account types -- Organization gets its own label, not a fallthrough to either Church or Member", () => {
  const src = read("app/profile/page.tsx");
  assert.match(src, /if \(accountType === "host"\) return "Church Host";/);
  assert.match(src, /if \(accountType === "organization"\) return "Organization Manager";/);
  assert.match(src, /return "Kingdom Member";/);
});

test("[SOURCE SCAN] Church onboarding's own host-specific gate is deliberately left untouched -- it is a sibling flow to Organization onboarding, not a merged one", () => {
  const src = read("app/onboarding/church/page.tsx");
  assert.match(src, /account[Tt]ype !== "host"/);
});

// ---------------------------------------------------------------------------
// [SOURCE SCAN] Dynamic terminology on the dashboard / profile surfaces
// ---------------------------------------------------------------------------

test("[SOURCE SCAN] the Host Dashboard header, church-profile edit link, and member-count stat all derive their label from entityLabel(entityType, ...), not a hardcoded 'Church' string", () => {
  const src = read("app/host-dashboard/page.tsx");
  assert.match(src, /entityLabel\(entityType, "dashboard"\)/);
  assert.match(src, /entityLabel\(entityType, "profile"\)/);
  assert.match(src, /entityLabel\(entityType, "members"\)/);
});

test("[SOURCE SCAN] ChurchProfileForm derives its Name field, page title, and save button from entityLabel, not a hardcoded 'Church Name'/'Save Church Profile'", () => {
  const form = read("app/host-dashboard/church-profile/ChurchProfileForm.tsx");
  assert.match(form, /entityLabel\(entityType, "nameField"\)/);
  assert.doesNotMatch(form, /label="Church Name"/);
  assert.doesNotMatch(form, /Save Church Profile/);
});

test("[SOURCE SCAN] the Members page header derives its label from entityLabel, not a hardcoded 'Church Members'", () => {
  const src = read("app/host-dashboard/members/page.tsx");
  assert.match(src, /entityLabel\(entityType, "members"\)/);
  assert.doesNotMatch(src, />Church Members</);
});
