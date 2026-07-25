# Phase 11 — Kingdom Economy & Progression System: Product & Technical Specification

Status: **Phase 11A — architecture and specification only. No implementation code included.**
Branch: `Production`. Not merged to `main`. Not deployed.

---

## 1. Executive summary

Phase 11 introduces a secure, auditable economy (credits, wallets, a transaction ledger) and a
progression system (points, XP, levels, badges, trophies, rewards, leaderboards) layered on top
of the real, Supabase-backed platform built in Phases 1–10 (churches, lessons, Lesson Journeys,
testimonies, Kingdom Scroll, Events, and the Phase 10 Experience Platform).

The repository audit (§2) found **no existing real economy or progression schema** — `profiles`
has no points/XP/level/wallet columns, and there is no credits/wallet/ledger/badge/trophy table
anywhere in `supabase/migrations/`. It also found that **`/dashboard`, `/badges`, and
`/leaderboard` are still wired to a pre-Supabase mock prototype layer** (`context/SessionContext`
data services, `services/{badgeService,journeyService,questService,notificationService}.ts`,
`data/*.ts`, `lib/storage.ts` localStorage) that is linked from real navigation and shown to real,
authenticated users — meaning today's "badges" and "leaderboard" are entirely fabricated
per-browser data, not real achievement records. Phase 11 must design the real replacement for
these three routes as part of its scope, not treat them as already solved.

Phase 11A's deliverable is this specification and its companion implementation plan — no schema,
RPC, UI, or route code is added this phase.

## 2. Repository audit

Searched: `supabase/migrations/*.sql`, `types/index.ts`, `services/**`, `data/**`, `app/**`,
`components/**`, `tests/**`, `docs/**`, `lib/navigation.ts`, `context/SessionContext.tsx`.

### 2a. Real, Supabase-backed functionality (source of truth today)

| Area | Table(s) | Notes |
|---|---|---|
| Identity/auth | `auth.users`, `public.profiles` | `profiles` has `full_name`, `email`, `account_type`, `avatar_url`, `is_platform_admin` only — **no stats/points/xp/level/credit columns of any kind**. |
| Churches | `churches`, `church_memberships` | `private.is_church_manager(church_id)` is the universal RLS gate reused by every later phase. |
| Lessons | `lessons`, `lesson_media`, `lesson_hosts`, `lesson_ministries`, `lesson_questions` | `lessons.quest_level` and `lessons.xp_reward` are **real, host-editable columns** (Build Experience form, `app/experience-builder/[lessonId]/edit/actions.ts`), displayed as static content metadata on `/lessons/[lessonId]` and `/journey/[lessonId]/experienced` ("Level 7", "250 XP Reward"). **They are never added to any member's running total anywhere in the codebase** — no code reads `xp_reward` and credits it to a profile. This is real schema that is functionally inert as progression data today (see §4, §11, §12 naming conflict). |
| Lesson Journeys | `lesson_journeys`, `lesson_journey_items` | The real, per-user, per-lesson stage tracker: `not_started → captured → studied → experienced → applied → added_to_story`. `markStudiedComplete()` (Phase 5) and `sync_journey_on_experience_completion` (Phase 10.3, migration `0026`) are the only two triggers currently advancing `current_stage`. RLS restricts every row to `auth.uid()`. |
| Testimonies | `testimonies`, `testimony_likes` | Dual approval: `church_status` (`pending/approved/rejected`, church-controlled) and `platform_status` (`not_submitted/pending/approved/rejected`, admin-controlled), each protected by its own trigger so neither party can set the other's column. Public/Kingdom Scroll visibility requires both `= 'approved'` and `visibility = 'public'` — this combined condition **is** "Kingdom Scroll publication." |
| Story engine | `characters`, `episodes`, `episode_characters`, `episode_lessons`, `character_testimonies` | Read-heavy narrative layer; `character_testimonies` surfaces only currently-fully-approved testimonies. |
| Experience Platform (Phase 10) | `church_experiences`, `church_experience_occurrences`, `church_experience_lessons`, `church_experience_registrations` | Full registration/waitlist/walk-in/attendance/completion lifecycle, 4 `SECURITY DEFINER` RPCs with row locking, no INSERT/DELETE policy on registrations (RPC-only writes). `completion_status` (`not_started/completed`) is a real, verifiable per-registration event — the strongest existing candidate trigger point for progression awards. |
| Events | `events` | **Request/approval only** — no RSVP, no attendance tracking, no registrant table. `payment_status` is stuck at `not_applicable`/`pending` (no `paid` value exists in the check constraint — confirmed by an existing regression test asserting exactly this, "no Square integration exists to ever set it"). **"Event attended" cannot be a real Phase 11 trigger yet** — Events has no attendance data model at all, unlike Experience occurrences. |
| Admin | `admin_moderation_log` | Admin-only audit trail (`profiles.is_platform_admin`-gated, `actor_id` pinned server-side, no bare `using(true)`). This is the correct structural precedent for the new economy audit/ledger table's RLS shape. |

### 2b. Mock/demo functionality (pre-Supabase prototype, still live in navigation)

A second, entirely separate application layer predates the real Supabase migration and is **still
linked from `lib/navigation.ts`** and rendered to real, currently-authenticated users:

| Route | Backing code | Data source |
|---|---|---|
| `/dashboard` | `services/journeyService.ts`, `services/badgeService.ts`, `services/questService.ts`, `services/notificationService.ts`, `services/lessonService.ts` | `lib/storage.ts` (browser `localStorage`, prefixed `qftk:`), seeded from `data/*.ts` |
| `/badges` | `services/badgeService.ts`, `data/badges.ts` | Same |
| `/leaderboard` | `services/questService.ts`, `data/users.ts`, `data/quests.ts` | Same |

The **identity** layer (`context/SessionContext.tsx` → `services/authService.ts` →
`lib/supabase/client.ts`) is real Supabase auth — a real signed-in user's `session.user.id` is
genuine. But everything built on top of it on these three routes (`getUserJourneys`,
`getUserBadges`, `getUserQuestResult`, `getAllBadges`) reads/writes **browser `localStorage`
only**, seeded from static fixture data (`data/badges.ts`'s six journey-stage badges;
`data/quests.ts`'s seeded quest scores; `simulateQuestCompletion()`'s `Math.random()`-based score
generator). None of it is shared across devices, none of it is real, and none of it reflects a
member's actual Lesson/Journey/Testimony/Experience activity in the real database. This is the
single most important finding of this audit: **`/dashboard`, `/badges`, and `/leaderboard` are
currently showing every signed-in user a fabricated per-browser achievement history**, while the
real achievement data (`lesson_journeys`, `testimonies`, `church_experience_registrations`) sits
unused by these three pages. `/my-journey` (Phase 5+) is the real, Supabase-backed replacement for
the journey-progress portion of `/dashboard` and already coexists alongside it without being
linked to it.

### 2c. Orphaned/legacy code inventory

- `context/SessionContext.tsx` — real auth wrapper, but exposes a `Session.user` shape from the
  mock `types/index.ts` `User` interface, not the real `profiles` row shape.
- `data/*.ts` (`badges`, `users`, `quests`, `journeys`, `testimonies`, `lessons`, `questions`,
  `hosts`, `notifications`, `storyEntries`, `characters`, `episodes`, `churches`, `speakers`,
  `featuredEvent`) — static seed fixtures for the mock layer. `data/backgrounds.ts` is the one
  exception: purely decorative image constants (`PageBackground`), used by real Supabase pages
  too, not business data.
- `services/{authService,badgeService,churchService,episodeService,journeyService,lessonService,
  notificationService,questService,storyService,testimonyService}.ts` — the mock CRUD layer over
  `lib/storage.ts`. `authService.ts` is the one file in this list that is *not* fully mock — its
  `getCurrentSession` genuinely calls the real Supabase client.
- `lib/storage.ts` — the localStorage read/write helper; its own header comment says "Phase Two
  will swap these calls for Supabase queries behind the same service function signatures," which
  never happened for these three routes even though it did happen for lessons/journeys/
  testimonies/experiences elsewhere in the app.

### 2d. Naming conflicts and schema-design hazards for Phase 11 to avoid

1. **"XP" already means two different things.** `lessons.xp_reward` (real, host-set, per-lesson,
   currently inert) vs. the Phase 11 brief's member-level cumulative XP (does not exist yet).
   **Resolved (§34.2)**: reuse `lessons.xp_reward` as the Lesson-completed award's base amount,
   clamped to a platform-configured ceiling at award time — see §12, §35 entry 12.
2. **`types/index.ts` mixes two unrelated type universes** in one file: mock, pre-Supabase
   interfaces (`User`, `Lesson` with a mock shape, `Badge`, `UserBadge`, `Journey`,
   `JourneyStage`, `QuestResult`) alongside real DB-row-mapped types introduced in later phases
   (e.g. `ChurchExperience`, `ChurchExperienceRegistration`). A new `Badge`/`Trophy`/`Wallet`/
   `LedgerEntry` type introduced for Phase 11 must not collide with the existing mock `Badge`
   interface already exported from this same file — Phase 11 will need new, disambiguated names
   (see §4) and should not silently shadow the old export.
3. **`Journey`/`JourneyStage`* (mock)** vs. **`lesson_journeys.current_stage`** (real) use the same
   stage vocabulary (`captured`/`studied`/`experienced`/`applied`/`added_to_story` vs. the mock's
   hyphenated `not-started`/`captured`/`studied`/`experienced`/`applied`/`added-to-story`) — enough
   of a near-collision that a careless progression-event hook could accidentally read from or
   write to the wrong one. Any Phase 11 trigger must be wired to the real `lesson_journeys` table
   only, never the mock `journeyService`.
4. **`church_experience_registrations.completion_status`** and a future economy ledger both need a
   concept of "источник" (source) — Phase 11's ledger `source`/`transaction_type` vocabulary (§7)
   must not be confused with Experience's own `registration_source` (`self`/`host_walk_in`) column
   from Phase 10 — different concepts, same word family.
5. **`events.payment_status`** already exists as a real column with exactly two values
   (`not_applicable`, `pending`) and an explicit regression test asserting it can never become
   `paid` without a real Square integration. Phase 11's future Square work (§27) must extend this
   existing column's check constraint (in a new migration, once approved) rather than invent a
   parallel payment-status concept for events.

### 2e. Security considerations carried forward

Every RLS/RPC pattern this spec proposes (§23, §24) deliberately reuses precedent already proven
across nine phases: `private.is_church_manager(church_id)` for church-scoped access,
`SECURITY DEFINER` + `set search_path = ''` + row locking (`for update`) for money-shaped RPCs
(modeled directly on Phase 10's `register_for_experience_occurrence`), and
`profiles.is_platform_admin` checked directly (never via a role string) for admin-only tables
(modeled on `admin_moderation_log`). No new authorization pattern is proposed.

### 2f. Technical debt this phase does not fix

`/dashboard`'s and `/leaderboard`'s continued presence in `lib/navigation.ts` pointing at mock data
is pre-existing technical debt, not something introduced by this audit. Retiring or replacing them
is explicitly proposed as in-scope Phase 11 work (§16, §29), not fixed in this Phase 11A
architecture-only pass.

## 3. Existing mock vs. real functionality (condensed)

| Concept | Real today? | Where |
|---|---|---|
| Member credits/wallet | No | — |
| Credit ledger | No | — |
| Member points | No | — |
| Member XP (cumulative) | No | — |
| Member level | No | — |
| Lesson-level XP value | **Yes** (inert) | `lessons.xp_reward` |
| Badges (real) | No | — |
| Badges (mock) | Yes, but fake/local | `data/badges.ts`, `services/badgeService.ts` |
| Trophies | No | — |
| Rewards | No | — |
| Leaderboard (real) | No | — |
| Leaderboard (mock) | Yes, but fake/local | `services/questService.ts` |
| Credit requests | No | — |
| Experience credit cost | No | `church_experiences`/`church_experience_occurrences` have no cost column today |
| Event attendance | No | `events` has no registrant/attendance table |
| Admin audit log pattern | **Yes** | `admin_moderation_log` (reusable precedent) |

## 4. Terminology (exact Phase 11 definitions)

- **Credit**: a spendable, fungible unit of access currency. Purchasable (future Square), grantable
  (platform/church), requestable (member → church), refundable, and spendable (Experience/event
  access, future platform purchases). Always backed by a ledger entry; never stored as a bare
  mutable integer alone.
- **Point**: a non-spendable, monotonically-increasing (except for an explicit admin reversal)
  lifetime achievement score. Drives rankings and milestone displays. Never spent, never
  transferred.
- **XP (member-level)**: a distinct progression value from Points, used only to compute **Level**.
  **Resolved (§34.1)**: kept as its own independent column/ledger dimension, not numerically
  aliased to Points, from day one. Its award amount for a Lesson-completed event **is** sourced from
  `lessons.xp_reward` (§34.2), clamped to a platform-configured ceiling at award time — the only
  case where the two concepts intentionally connect, and only through that server-side clamp.
- **Level**: a derived value computed from cumulative XP against a fixed, versioned threshold table
  — never stored as the source of truth, always recomputed (or cached and reconciled) from XP.
- **Badge**: a named, discrete achievement for a specific accomplishment (e.g. "First Lesson
  Completed"). Binary earned/not-earned per member (with support for a lesson/Experience/testimony-
  scoped repeat instance where meaningful, mirroring the existing mock model's per-lesson badge
  instances).
- **Trophy**: a rarer, larger-scope accomplishment (a season, campaign, or major milestone) —
  modeled in v1 as a high-tier Badge category (see §14), not a separate table, until real demand for
  trophy-only behavior (e.g. time-boxed seasons) emerges.
- **Reward**: a benefit unlocked by an achievement — may itself be a credit grant, an Experience
  access unlock, a cosmetic/recognition item, or (future) a physical item. A Reward is the *effect*
  of earning a Badge/Trophy/level-up, not a fourth ledger-like table in v1 — see §16.
- **Wallet**: an entity (member or church) that owns a credit balance. The balance is derived
  from/reconciled with the Ledger, never authoritative on its own (see §7).
- **Ledger**: the single, append-only, immutable table of every credit-affecting event. The only
  source of truth for "why does this wallet have this balance."

## 5. Product rules (summary)

1. No client ever decides a balance, a spend outcome, an award, or a level — only server-side
   RPCs/triggers do, exactly like every money-adjacent or authorization-adjacent decision in
   Phases 1–10.
2. Every credit movement has exactly one Ledger row explaining it. No Ledger row is ever deleted or
   mutated after creation (append-only; a correction is a new reversal row, never an edit).
3. A member's balance can never go negative unless a future, explicitly-approved policy allows it
   (v1 default: never).
4. A Point or XP award for a given (member, event type, source row) combination happens at most
   once — enforced by a unique constraint, not just application logic.
5. Church-granted credits ultimately trace back to a platform-issued allocation; a church can never
   mint credits from nothing (§6).
6. Every write path this spec proposes has both an RLS policy and, where money or duplicate-award
   risk exists, a `SECURITY DEFINER` RPC with row locking — mirroring Phase 10's registration RPCs
   exactly.

## 6. Wallet ownership

**Members**: yes, from v1. Own balance, can receive grants, spend, receive refunds, view history.

**Churches**: yes, from v1, but constrained — a church wallet can only ever hold credits that
trace back to a `platform_grant` (or a reversal of one). A church cannot self-mint balance. This
is enforced the same way `protect_church_experience_ownership` enforces its invariant: a
constraint/trigger on the ledger/RPC layer, not a client-trusted rule.

**Platform administration**: not a wallet in the member/church sense — the platform is the
issuer of first-resort. Modeled as the "no wallet row required" origin of every `platform_grant`
and `promotional_credit` ledger entry (the RPC checks `profiles.is_platform_admin` directly,
exactly like `admin_moderation_log`'s insert policy, rather than needing a balance of its own to
debit from).

**Future organizations**: explicitly deferred. No schema hook is added for a third wallet-owner
type in Phase 11 — if a future "organization" concept emerges (e.g. a denomination or network
above individual churches), it can reuse the same table shape recommended below by adding a third
nullable owner-type branch, without a breaking change, because of the explicit-tables design
chosen next.

**Explicit tables, not one polymorphic wallet.** Recommendation: **two explicit tables**,
`member_wallets` (one row per profile) and `church_wallets` (one row per church), each with its own
narrow RLS policy set, rather than one polymorphic `wallets` table with an `owner_type`/`owner_id`
pair. Rationale: this repository's own precedent consistently favors explicit, narrowly-scoped
tables with table-specific RLS over generic/polymorphic structures (e.g. separate
`church_experience_lessons` rather than a generic "attachments" table; separate `church_status`/
`platform_status` columns rather than a generic status-history table) — and a polymorphic wallet
would need its own CHECK-constrained `owner_type` plus conditional RLS branching per type, which is
strictly more complex than two small tables for exactly the two owner types this phase actually
needs. This avoids unnecessary abstraction per the brief's own instruction.

## 7. Credit ledger

**Table**: `credit_ledger_entries` (name chosen to avoid any collision with the unrelated
`admin_moderation_log` "log" word and to read unambiguously as the economy's ledger).

Columns (conceptual, not final DDL — Phase 11A does not write migrations):

- `id` (uuid pk)
- `member_wallet_id` (uuid, nullable) + `church_wallet_id` (uuid, nullable), each a real foreign
  key to its own wallet table, with a `CHECK` constraint enforcing exactly one is non-null.
  **Resolved (§34.4)**: two explicit nullable FK columns, not a generic `wallet_type`/`wallet_id`
  pair — this lets each reference be enforced by a real foreign key against its specific table,
  which a type-tagged generic column cannot be.
- `amount` (integer, always positive) + `direction` (`credit` | `debit`) — signed amount stored
  as two explicit columns rather than a single signed integer, so a query can never silently
  misinterpret sign; the actual balance effect is `direction = 'credit' ? +amount : -amount`.
- `transaction_type` (see enumerated list below)
- `status` (`pending` | `completed` | `failed` | `reversed`)
- `source` (free-text/enum describing what produced this row: `platform_admin`, `church_host`,
  `member_request`, `rpc:register_for_experience_occurrence`, `square_webhook` (future), etc.)
- `related_profile_id`, `related_church_id`, `related_experience_id`,
  `related_occurrence_id`, `related_event_id`, `related_purchase_id` (future),
  `related_refund_of_entry_id` (self-referencing, nullable) — all nullable foreign keys, populated
  only when relevant, exactly like Phase 10's registration row carries nullable
  `capacity_override`/etc. rather than one generic `metadata` blob for everything structural.
- `created_by` (uuid, references `profiles.id`, nullable only for a system/trigger-originated row)
- `idempotency_key` (text, unique where not null) — required for every RPC-originated row that
  could plausibly be retried (a request, an RPC call, a future webhook); optional for a
  human-typed admin adjustment.
- `description` (text, human-readable, always populated)
- `metadata` (jsonb, nullable) — used only for genuinely-unstructured extra detail (e.g. a future
  Square line-item breakdown), never for a value this spec already names as its own column.
- `created_at` (timestamptz, default `now()`) — append-only, never updated.
- `effective_at` (timestamptz, default `now()`) — allows a future backdated/scheduled entry
  (e.g. a promotional grant effective on a future date) without conflating it with row-creation
  time.
- `reversed_by_entry_id` / `reverses_entry_id` (self-referencing, nullable pair) — a reversal is
  always a new row pointing back at the original, never a mutation of the original.

**Transaction types** (fixed enum, versionable by adding new values in a future migration, never
by repurposing an old one): `platform_grant`, `church_grant`, `member_request_approved`,
`purchase` (future Square), `experience_spend`, `event_spend` (future, once Events gains real
attendance), `refund`, `promotional_credit`, `administrator_adjustment`, `reversal`. `expiration`
is explicitly **not** included in v1 — deferred until credit expiration itself is approved (§35).

**Balance model — recommendation: calculated from the ledger, with a reconciled cached column.**
Three options were evaluated:

1. *Pure calculation* (`SUM` over ledger rows on every read) — simplest, always correct, but does
   not scale indefinitely and can't be indexed as a single value for a leaderboard-style "richest
   member" query (not currently needed, but worth naming as a limitation).
2. *Stored, transactionally synchronized* — a `balance` column on `member_wallets`/`church_wallets`
   updated in the same transaction as every ledger insert, inside the same `SECURITY DEFINER` RPC,
   with `for update` row locking on the wallet row (exactly like Phase 10 locks the occurrence row
   before adjusting its capacity/registration count).
3. *Database view* — a `create view wallet_balances as select wallet_id, sum(...) ...` — always
   correct like option 1, avoids a sync bug like option 2, but cannot be indexed/queried as cheaply
   as a stored column and (in Postgres) cannot itself be the target of a `for update` lock for the
   spend-atomicity requirement in §11.

**Recommended**: **option 2** — a stored `balance` column, updated only inside the same
`SECURITY DEFINER` RPC transaction that inserts the corresponding ledger row, with `for update`
locking on the wallet row before either the balance check or the update (mirroring
`register_for_experience_occurrence`'s `select ... for update` on the occurrence row exactly). A
periodic (not client-triggered) reconciliation job/RPC that recomputes balance from
`sum(ledger entries)` and asserts equality is recommended as a safety net (documented as future
work in the implementation plan, not built in Phase 11A), giving the safety of option 1 as a
verification tool without giving up option 2's query/index performance.

## 8. Credit requests

**Table**: `credit_requests` — one row per member request directed at one church, optionally tied
to one Experience.

Statuses (exact set from the brief): `submitted`, `under_review`, `declined`, `cancelled`,
`fulfilled`, plus `approved` as a real status in the constraint even though it is normally a
same-transaction pass-through into `fulfilled` (see below) — kept as its own value so a future
two-step approval-then-fulfillment workflow (e.g. a batch nightly disbursement) doesn't require a
schema change.

Decisions (owner-approved — §34):

- **Requested credits go directly to the member wallet**, not reserved for one Experience only.
  Rationale: matches how the rest of this app treats a credit as fungible access currency (§4), and
  avoids inventing an "Experience-scoped credit" sub-type that would need its own spend-priority
  rule at checkout time. A request still *names* the Experience that motivated it (for the host's
  review context and for reporting), but approval grants fungible balance.
- **Unused granted credits remain available** for any future Experience/event at that member's
  churches — not clawed back if unspent.
- **Churches have grant limits, strictly enforced (§34.6)**: a church's total grant/approval
  capacity is bounded by its own wallet balance (§6), with zero exceptions — a host cannot approve
  a request the church wallet can't cover, enforced by the same balance-check-then-debit RPC
  pattern as a member's own spend.
- **Requests do not expire automatically in v1 (§34.7)** — no documented reason yet exists to
  justify the added complexity of an expiration policy.
- **Reviewable by**: any profile with `church_memberships.role` satisfying
  `private.is_church_manager(church_id)` for the request's target church — identical authorization
  boundary to every other host-review workflow in this app (lesson requests, testimony church
  approval).
- **Visible member information**: the reviewing host sees exactly what a host already sees
  reviewing a lesson request or a testimony — display name, and (for the credit request
  specifically) the requested amount, the naming Experience if any, and the member's own written
  reason — never another church's data, never payment/financial details beyond the request itself.

Workflow: `submitted → under_review → (approved → fulfilled) | declined | cancelled`. The
`approved → fulfilled` transition happens inside one atomic RPC (host action triggers both status
change and the ledger grant in the same transaction) so a request can never sit "approved but never
actually credited."

## 9. Experience access

**Cost lives on the Experience definition, with an occurrence-level override** — mirroring
exactly how Phase 10 already models `capacity` (`church_experiences.default_capacity` +
`church_experience_occurrences.capacity` override) and location/online-URL (Experience default +
occurrence override). A new nullable `credit_cost` column at both levels follows the identical
precedent: `null` cost means free (not zero-as-a-magic-number — `null` is the "no cost" sentinel,
consistent with how `default_capacity: null` already means "unlimited" in this schema).

**Reservation/deduction timing — recommended lifecycle:**

- **Registration** (status `confirmed`, not `waitlisted`): verify balance, then deduct credits
  atomically in the same `SECURITY DEFINER` RPC transaction that creates the registration row —
  extending `register_for_experience_occurrence` itself (in a future implementation phase) rather
  than adding a second, separately-timed spend step, so there is never a window where a
  registration exists without its cost already having been verified and moved.
- **Waitlist**: **do not charge until promotion** — a waitlisted registration reserves a spot, not
  credits. This avoids holding a member's balance hostage for an Experience they may never actually
  attend, and matches the brief's own suggested default. `promote_waitlist_registration` (existing
  RPC) is the natural point to add the balance check + deduction when a waitlist slot is promoted
  to confirmed.
- **Member cancellation — approved final rule (§34.3)**: a full credit refund is issued when
  cancellation occurs before the occurrence's `registration_closes_at`; if that column is `null`,
  the cutoff falls back to `starts_at`; cancellation at or after the cutoff receives no
  member-cancellation refund. The check is performed entirely server-side inside the cancellation
  RPC, reading the occurrence's own stored timestamps directly — the client never computes or
  authorizes the refund outcome.
- **Church cancellation of the occurrence**: **full automatic refund**, no exceptions — the member
  did nothing wrong, so this is not a policy choice.
- **No-show**: no refund (credit already spent to reserve the seat; attendance is a separate
  concern from payment, per the brief's own framing).
- **Attendance recorded**: no credit effect by itself — attendance and completion are
  progression-relevant (§7 of this spec's terminology / §10 below), not economy-relevant.
- **Completion**: no further credit effect; may independently award XP/points (§10) regardless of
  how (or whether) the Experience was paid for.
- **Free Experiences**: `credit_cost = null` at both levels — no ledger row is created for a free
  registration at all, avoiding a stream of meaningless zero-amount ledger noise.
- **Host waiver**: recommended — a host may register/confirm a specific member at zero cost via an
  explicit "waive cost" flag on the same walk-in/host-assisted path Phase 10 already has
  (`record_experience_walk_in`'s `registration_source = 'host_walk_in'`), not a silent client-side
  override; this still produces an explicit "waived" ledger-adjacent record for auditability
  (either a zero-amount ledger row tagged accordingly, or an explicit `capacity_override`-style
  boolean plus a `description` — an implementation-phase decision, not decided here).

No client ever computes or asserts a balance or a spend outcome — every check above happens inside
the same locked, `SECURITY DEFINER` RPC transaction, exactly like every existing Experience RPC.

## 10. Refund rules (summary — see §9 for full lifecycle)

| Scenario | Refund? |
|---|---|
| Member cancels before `registration_closes_at` (or `starts_at` if that column is null) | Full refund |
| Member cancels at or after that cutoff | No refund |
| Church cancels the occurrence | Full refund, always |
| No-show | No refund |
| Waitlisted registration never promoted, member withdraws | No refund needed — nothing was ever charged |
| Host-approved credit request later found to be issued in error | `administrator_adjustment`/`reversal` ledger entry, never a silent balance edit |

## 11. Points

Points are awarded by fixed, server-recognized event types only (no open rule engine — see §34 of
the brief's own instruction, honored directly): Lesson completed (Studied stage), Experience
completed, Reflection completed (where a distinct reflection-submission event exists), Testimony
submitted, Testimony approved by church, Testimony published to Kingdom Scroll (both statuses
approved + public visibility), Event attended (**deferred** — no attendance model exists yet, §2a),
Story contribution featured, Community milestone (a manually-triggered admin award, not an
automatic event).

Each event type has a fixed point value in a versioned, database-backed award-definitions table
(§34 naming: `progression_award_rules`), not a hard-coded number in application code — so a value
can be tuned without a deploy, while still being server-side-only (no client ever supplies its own
point amount).

## 12. XP

Modeled as its own value, separate from Points (§4), computed by the same fixed event types and
the same award-definitions table, but with its own award-amount column so the two can diverge
per event type even if their initial values start out equal. **Resolved (§34.2)**: the
Lesson-completed award reads its base XP amount from that lesson's own `xp_reward` column
(formalizing it as real progression input for the first time, since a host already sets this value
intentionally per lesson), but the `award_progression_event` RPC clamps that value to a
platform-configured ceiling (`max_lesson_xp_award` in `progression_award_rules`) before crediting
the member — an unrestricted host-entered value can never translate into unlimited XP. The exact
ceiling is set at Phase 11.3 implementation time, after a spot-check of real production
`xp_reward` values (§33).

## 13. Levels

Derived, not stored as the source of truth: a fixed, versioned XP-threshold table
(`progression_level_thresholds`: `level`, `min_xp`, `version`) determines a member's level from
their cumulative XP. Level is computed on read (or cached on the member's progression summary row
and reconciled the same way wallet balance is, §7) — never client-supplied, never itself the
target of a direct write.

## 14. Badges

**Badge definitions** (`badge_definitions`): `id`, `slug` (unique), `name`, `description`,
`image_url`, `category`, `requirement_type` (fixed enum: `event_count`, `single_event`,
`threshold`), `threshold` (nullable integer, used when `requirement_type = threshold`), `is_active`,
`is_hidden_until_earned`, `display_order`.

**Member awards** (`member_badge_awards`): `member_id`, `badge_id`, `award_source` (which event
type produced it), `related_lesson_id`/`related_experience_id`/`related_testimony_id`/
`related_event_id` (nullable, whichever applies), `awarded_at`, `awarded_by` (nullable — null for
an automatic system award, populated for a manual admin award), `revoked_at`, `revocation_reason`
(both nullable — a revoked award is never deleted, only marked, preserving history exactly like
this app never hard-deletes anything, per the project's standing convention).

A unique constraint on `(member_id, badge_id, related_*_id)` (whichever related-id column applies
per badge category) prevents the same duplicate award from being inserted twice — the schema-level
enforcement of "duplicate prevention," not just an application-level check.

**Named v1 badges to seed** (from the brief, mapped to real trigger events found in §2a): First
Lesson Completed (Studied stage transition), First Experience Completed
(`church_experience_registrations.completion_status → completed`), First Testimony Submitted
(`testimonies` insert), Church-Approved Testimony (`church_status → approved`), Kingdom Scroll
Contributor (both statuses `approved` + `visibility = public`).

## 15. Trophies

**Recommendation: no separate table in v1.** Modeled as `badge_definitions.category = 'trophy'`
(a reserved category value, not a new concept) — the smallest coherent v1 model per the brief's own
instruction. If a genuinely trophy-specific need emerges later (e.g. a time-boxed seasonal
leaderboard trophy that must expire or reset in a way a permanent badge never does), that becomes
its own migration at that time rather than speculative schema now.

## 16. Rewards

**Recommendation: not a fourth standalone ledger-shaped table in v1.** A Reward is modeled as the
*effect* of a Badge/Trophy/level-up: earning one may optionally trigger a `promotional_credit`
ledger entry (a credit reward) or simply be its own recognition (a cosmetic reward, no further
effect needed beyond the badge/trophy record itself). A `reward_definitions` table is recommended
only for the specific case of "this badge, when earned, also grants N credits" — a narrow join
table (`badge_definitions.id → optional credit amount`), not a generic unlockable-items catalog,
which would be speculative for a platform with no digital/physical item inventory yet.

**`/badges` transition plan**: the real replacement reads `badge_definitions` (all badges, filtered
by `is_hidden_until_earned`) and `member_badge_awards` (the signed-in member's own, via RLS
`member_id = auth.uid()`) directly from Supabase, replacing `data/badges.ts`/`badgeService.ts`
entirely, in place at the existing `/badges` route. **Resolved (§34.5)**: `/dashboard` is retired
outright at Phase 11.4 (not kept as a thin summary alongside the new pages) — its badge-summary
traffic routes to `/my-journey` and the new `/rewards`/`/badges` routes instead.

## 17. Leaderboards

Existing `/leaderboard` audited (§2b): entirely mock, quest-score-based, `Math.random()`-seeded.
Real replacement scopes: **Global** (all members, by lifetime Points), **My Church** (members of
the signed-in user's own church(es) only, via `church_memberships`), **Lesson** (per-lesson
completion-based ranking, if a per-lesson score concept survives into v1 — otherwise deferred),
**Experience** (per-Experience completion-based ranking), **All-time** (default), **Seasonal**
(explicitly future — depends on the Trophy/season concept in §15 maturing beyond v1).

- **Ranking metric**: lifetime Points (not XP, not credits — Points is defined in §4 as exactly
  this: the non-spendable rank-driving score).
- **Tie behavior**: stable secondary sort by `earned_at`/`created_at` ascending (earlier achiever
  ranks higher on a tie), not an arbitrary/unstable order.
- **Privacy**: a member-level `leaderboard_opt_out boolean default false` column (on the member's
  progression summary row, not `profiles` itself, to keep `profiles` unchanged) lets a member
  exclude themselves from every public leaderboard scope while still accruing Points/XP privately.
- **Display name**: uses `profiles.full_name` (or a future display-name preference) — never raw
  email, matching every existing public-facing member-name display elsewhere in this app
  (testimonies, Kingdom Scroll).
- **Deactivated/deleted users**: excluded from every leaderboard query (a `deleted_at`/active-status
  join condition, or simply relying on the `profiles`/`auth.users` cascade-delete already in place
  — an implementation-phase detail).
- **Pagination**: yes, from v1 — unlike the Experience Platform's registrant lists (where list
  sizes are naturally small per occurrence), a Global leaderboard can genuinely grow to the
  platform's full member count, so this is a case where pagination is actually needed, not scope
  creep.
- **Indexes**: a covering index on `(scope-relevant column, points desc, earned_at asc)` per
  supported scope — finalized at implementation time.
- **Cross-church isolation**: "My Church" scope never exposes a member from a church the viewer
  doesn't belong to; "Global" scope shows only points/rank/display name, never any church-private
  data (email, request history, credit balance).

## 18. Host administration

Church hosts/admins (via `private.is_church_manager`) get: church wallet balance (read-only balance
+ full grant history), member credit requests (review/approve/decline queue scoped to their own
church only), credit grants (issue directly to a member without a prior request, still debited from
the church wallet), grant history (their own church's ledger entries only), member progression
summaries (Points/XP/Level/Badges for their own church's members — read-only, never able to
directly award/revoke a badge or adjust points themselves; that remains platform-admin-only, §19).
Hosts have **no ability to modify platform-wide rules** (award-definitions, level thresholds, badge
definitions, credit packages) — enforced by RLS requiring `profiles.is_platform_admin` directly on
every rule-definition table, exactly like Phase 9's admin-only tables.

## 19. Platform administration

Platform admins (via `profiles.is_platform_admin`, checked directly — never via a role string, per
this repo's standing convention) get: credit package definitions (future Square catalog mapping),
credit grants (to any member or church), manual balance adjustments, reversals (of any ledger
entry), badge/trophy definitions (create/edit/retire), point/XP rule definitions
(`progression_award_rules`), full audit history across every wallet/ledger/award, and a
"suspicious activity" review surface (e.g. a query view flagging any member with an unusually high
recent adjustment count or a reversed-then-reissued pattern — a reporting view, not a new
enforcement mechanism, in v1).

## 20. Member experience

A signed-in member gets: their own balance, full transaction history (their own ledger entries
only, via RLS `related_profile_id = auth.uid()` or the wallet-ownership equivalent), their own
credit requests (submit new, view status of past), Points, XP, Level, Badges (earned + visible-not-
yet-earned, per `is_hidden_until_earned`), Trophies (as a Badge category, §15), and a reward
history (any `promotional_credit`/badge-triggered grant, surfaced in the same transaction history
rather than a separate feed).

## 21. Proposed schema (conceptual — no migration written this phase)

New tables: `member_wallets`, `church_wallets`, `credit_ledger_entries`, `credit_requests`,
`progression_award_rules`, `progression_level_thresholds`, `member_progression_summaries` (one row
per member: cumulative points, cumulative XP, derived level cache, `leaderboard_opt_out`),
`badge_definitions`, `member_badge_awards`, `reward_definitions` (narrow badge→credit-amount join,
§16). Extended existing tables (future migration, not this phase): `church_experiences` +
`church_experience_occurrences` gain a nullable `credit_cost` column each (§9); `events` gains
whatever attendance model a future phase adds before `event_spend`/"Event attended" can become
real (out of scope for Phase 11 itself, §36).

## 22. Constraints and indexes (representative, not exhaustive — finalized at implementation time)

- `member_wallets.profile_id` unique (one wallet per member); `church_wallets.church_id` unique.
- `credit_ledger_entries.idempotency_key` unique where not null.
- `member_badge_awards` unique on `(member_id, badge_id, coalesce(related_lesson_id, ...))` per
  badge category's relevant related-id column.
- `credit_requests` indexed on `(church_id, status)` for the host review queue;
  `credit_ledger_entries` indexed on `(wallet_type, wallet_id, created_at desc)` for transaction
  history and on `(related_profile_id)`/`(related_church_id)` for lookups.
- `member_progression_summaries` indexed per leaderboard scope as noted in §17.
- Every foreign-key column that will actually be filtered/joined gets an index, following the
  Phase 10 precedent verified in `docs/PHASE10_4_AUDIT.md` §2.

## 23. RLS design

Every new table gets its own explicit RLS policies, no bare `using(true)` anywhere a balance,
ledger, request, or award is involved (mirroring the Phase 1 audit rule enforced by
`tests/rlsChurchIsolation.test.ts`'s generic loop, which Phase 11 should extend to cover every new
table by name):

- `member_wallets`/ledger rows scoped to that member: `select`/relevant columns gated by
  `profile_id = auth.uid()`, no direct client `insert`/`update` policy at all — identical shape to
  `church_experience_registrations` (no INSERT policy; all writes via RPC).
- `church_wallets`/church-scoped ledger rows/`credit_requests`: gated by
  `private.is_church_manager(church_id)` for management, plus a narrower "member sees their own
  request" policy on `credit_requests` (`requested_by = auth.uid()`).
- `badge_definitions`/`progression_award_rules`/`progression_level_thresholds`: public `select`
  (members need to see badge catalogs and level thresholds), admin-only `insert`/`update`/`delete`
  gated by `profiles.is_platform_admin` directly.
- `member_badge_awards`/`member_progression_summaries`: member sees their own row(s)
  (`member_id = auth.uid()`); a church manager sees their own members' rows (join through
  `church_memberships`, mirroring the existing `profiles` church-manager-read policy from Phase 2);
  a platform admin sees all.

## 24. RPC design

Every balance-affecting or duplicate-risk-bearing operation is a `SECURITY DEFINER` RPC with
`set search_path = ''` and `for update` row locking on the wallet (and, where relevant, occurrence)
row before any check or write — the exact shape of Phase 10's four registration RPCs. Candidate
RPCs: `grant_credits` (platform → any wallet), `request_credits` (member → church, creates a
`credit_requests` row), `review_credit_request` (host approve/decline, atomic grant-on-approve),
`spend_credits_for_experience` (extends/wraps `register_for_experience_occurrence`), `refund_credits`
(cancellation paths), `reverse_ledger_entry` (admin-only), `award_progression_event` (the single,
fixed-event-type entry point every real trigger — Studied completion, Experience completion,
testimony approval, Kingdom Scroll publication — calls into, so duplicate-award prevention and
point/XP/badge logic live in exactly one place rather than being re-implemented at each call site).

## 25. Idempotency

Every RPC above accepts (or derives, from `(member_id, event_type, related_row_id)`) an
idempotency key and checks `credit_ledger_entries.idempotency_key` (or the equivalent unique
constraint on `member_badge_awards`/progression event rows) before acting — a retried call (e.g. a
double-submitted form, a future Square webhook redelivery) is a safe no-op, never a duplicate
award or double-spend.

## 26. Security and abuse prevention

| Threat | Mitigation |
|---|---|
| Double spending | Row-locked (`for update`) balance check + debit in one RPC transaction |
| Duplicate webhook fulfillment (future Square) | Idempotency key unique constraint on the ledger entry |
| Duplicate event rewards | Unique constraint on `(member_id, event_type, related_row_id)` for progression awards |
| Forged completion | Progression RPCs read `completion_status`/`church_status`/`platform_status` from the real row server-side, never trust a client-asserted "I completed this" |
| Client balance manipulation | No client-writable balance column anywhere; RLS has no UPDATE policy on `member_wallets.balance`/`church_wallets.balance` for any role except the RPC (running as the function owner) |
| Cross-church credit transfers | Every grant/spend RPC checks the wallet's owning church/member matches the authorized actor and target; no RPC accepts an arbitrary destination wallet without an authorization check |
| Unauthorized adjustments | `administrator_adjustment`/`reversal` require `profiles.is_platform_admin` directly, checked inside the RPC, not just at the RLS layer |
| Replay attacks | Idempotency keys (see above) |
| Negative balances | Balance check happens before debit inside the locked transaction; no negative-balance path exists unless a future policy explicitly approves overdraft |
| Race conditions | `for update` locking on the wallet row, exactly like Phase 10 locks the occurrence row |
| Admin misuse | Every admin action still writes its own ledger/audit row — an admin cannot silently edit a balance without leaving a `administrator_adjustment` entry, and every such entry has `created_by` populated |
| Deleting transaction history | No DELETE policy/capability anywhere on `credit_ledger_entries` or `member_badge_awards` — append-only, reversal-only, exactly like this app's standing "no hard deletes" convention |

## 27. Future Square integration (extension points only — no Square code this phase)

Documented needs for a future, separately-approved phase: Square merchant account, Application ID,
Access token, Location ID, webhook signature key, sandbox config, production config,
product/catalog mapping (credit packages), checkout session creation, **signed webhook signature
verification** (never trust an unsigned callback), idempotent fulfillment (via the same
`idempotency_key` mechanism already designed in §7/§25, keyed off Square's own event/payment id),
refund processing (a `refund` ledger entry triggered only by a verified Square refund webhook, not
a client claim), chargeback handling, receipts, tax considerations. **Binding rule, restated from
the brief**: credits are fulfilled only after a verified server-side payment confirmation (a
correctly-signed webhook or an authenticated server-to-server status check) — never from a client
"success" redirect page alone. `events.payment_status`'s existing check constraint (§2d.5) is
extended, not replaced, once this future phase is scoped.

## 28. Future ChatGPT integration (extension points only — no OpenAI code this phase)

Documented future capabilities: personalized Experience recommendations, lesson recommendations,
suggested challenges, reflection prompts, achievement summaries, reward suggestions, church
engagement insights. **Binding rule**: all future AI access goes through one centralized,
server-side AI service (not scattered per-route API calls), and AI **never directly alters a
balance, issues a credit, awards a badge, or publishes a reward** — it may only ever *suggest*,
with any resulting action still flowing through the same verified-event/authorized-review RPCs
this spec already defines (§24). No OpenAI API key or call exists anywhere in Phase 11A.

## 29. Routes and UI

Existing route/nav conventions inspected (`lib/navigation.ts`, `app/host-dashboard/*`,
`app/admin/*`) before proposing paths — this app already separates member routes (bare `/x`), host
routes (`/host-dashboard/x`), and admin routes (`/admin/x`) consistently; Phase 11 follows the same
shape.

**Member routes**: `/wallet` (balance + transaction history — combines the brief's suggested
`/wallet` and `/credits` into one screen with tabs, avoiding a duplicate-page split the brief itself
warns against), `/rewards` (Points/XP/Level/reward history), `/badges` (real replacement, §16),
`/leaderboard` (real replacement, §17), `/credit-requests` (submit + track own requests).

**Host routes**: `/host-dashboard/credits` (church wallet balance + grant history + issue a direct
grant), `/host-dashboard/credit-requests` (review queue), `/host-dashboard/member-progress`
(read-only Points/XP/Level/Badges summary for their own church's members).

**Admin routes**: `/admin/economy` (a dashboard/index tying together credit packages, grants,
adjustments, reversals, and audit history as tabs of one screen, rather than the brief's suggested
`/admin/credits` + `/admin/transactions` as fully separate pages — same "avoid duplicate pages
where tabs are more coherent" instruction applied), `/admin/rewards` (badge/trophy/reward-rule
definitions), `/admin/badges` folded into `/admin/rewards` as a tab rather than a fifth separate
admin page.

For every screen (finalized per-screen detail deferred to the implementation-phase UI work, not
exhaustively pre-specified here to avoid speculative UI design before real data shapes are built):
role, purpose, primary actions, data dependencies, loading/empty/error states, and mobile behavior
all follow the exact pattern already established and audited across every Phase 10 Experience
Platform screen (`docs/PHASE10_4_AUDIT.md` §7–9) — same `ErrorState`/`EmptyState` components, same
`FormField`/`Field` accessible-label pattern, same responsive grid/flex-wrap conventions. Security
rule per screen: every host/admin screen re-derives authorization server-side from the actual
target row's owning church/admin-flag, never from a client-supplied id alone — exactly Phase 10's
`getAuthorizedExperience`-style guard pattern, to be replicated as `getAuthorizedWallet`/
`getAuthorizedCreditRequest`/etc. in the implementation phase.

## 30. Testing strategy

| Category | Coverage |
|---|---|
| Unit | Award-amount lookup, level-from-XP threshold calculation, badge-requirement evaluation — pure functions, `node:test`, matching this repo's existing `lib/*Form.ts`/`lib/experienceTimezone.ts` unit-test precedent |
| Integration | Not available in this sandbox (no live Supabase credentials wired into `npm test`, same limitation documented in every prior phase) — real behavioral verification happens via direct `supabase db query` against the linked project once implemented, as Phase 10.4 did |
| Database/RLS | Structural tests reading actual migration SQL, extending `tests/rlsChurchIsolation.test.ts`'s existing pattern: no bare `using(true)` on any new table, every new table has manager/self/admin-appropriate policies, no INSERT/DELETE policy on ledger/award tables |
| RPC | Structural tests confirming every new RPC is `SECURITY DEFINER`, has `search_path` locked, uses `for update` locking, checks authorization before any write — same pattern as `tests/rlsChurchIsolation.test.ts`'s existing RPC assertions for Phase 10's four RPCs |
| Browser/end-to-end | Blocked by the same missing-`.env.local` sandbox limitation documented since Phase 1; requires `.env.local` or a Vercel Preview |
| Manual QA | A checklist mirroring `docs/PHASE10_4_AUDIT.md` §4's honest tested/reviewed/blocked classification, produced at the end of whichever implementation phase actually ships each piece |

Specific scenarios to cover once implemented: wallet creation, credit grants (platform→member,
platform→church, church→member), credit requests (submit/approve/decline/cancel), spending
(sufficient and insufficient balance), concurrent spending (two simultaneous spends racing against
one balance), refunds, reversals, idempotency (retried RPC call is a no-op), duplicate reward
prevention (same event fired twice awards once), points/XP awards, level computation, badge
awards (including revocation), trophy awards (as a badge category), leaderboard scoping and
church isolation, admin-only authorization on rule-definition tables, raw-API bypass attempts
(direct `.insert()`/`.update()` against ledger/wallet tables rejected by RLS), and a future Square
webhook replay-protection test once that phase begins.

## 31. Migration strategy

No migration is written in Phase 11A. Per the binding rule carried forward from Phase 10.4,
migrations `0001`–`0026` remain immutable; the first Phase 11 schema migration (once an
implementation phase is approved) starts at **`0027`**, following this project's established
`000N_*.sql` numbering and one-topic-per-migration convention (e.g. `0027_credit_wallets_ledger.sql`,
`0028_credit_requests.sql`, `0029_progression_badges.sql` — exact splitting decided at
implementation time based on how Phase 10's own migration sequence was split by topic).

## 32. Rollback considerations

Every new table is purely additive (no column added to `profiles`/`lessons`/`church_experiences`/
`events` in the foundational migration — the `credit_cost` columns on Experience tables and any
future `events` attendance work are their own later, separately-reversible migrations). A rollback
of the foundational economy migration is a straightforward `drop table` sequence in reverse
dependency order, since no existing table's data depends on the new tables existing. RPC/trigger
rollback follows the same `drop function`/`drop trigger` pattern already used throughout
`supabase/migrations/`. No existing table's RLS is altered by the foundational Phase 11 migration,
so no existing access pattern is at risk during rollback.

## 33. Risks

- **Scope risk**: this is the largest single product area since Phase 1 (money + progression +
  admin tooling across three audiences) — the phased roadmap (§16 of the brief, formalized in
  `docs/PHASE11_IMPLEMENTATION_PLAN.md`) is the primary mitigation.
  - **Legacy-route risk**: `/dashboard` and `/leaderboard` are currently live and linked in
  navigation showing fabricated data to real users; leaving them as-is through a long
  implementation window continues showing that fabricated data, but replacing them prematurely
  (before real Points/Badges data exists) would show an empty/broken screen instead — the
  implementation plan should sequence the real Badges/Leaderboard UI (Phase 11.3/11.4) only once
  the underlying data-producing triggers (Phase 11.2/11.3) are live.
- **Duplicate-award risk**: any missed unique constraint on a progression-award table is a real
  correctness bug (a member could be awarded twice) — mitigated by designing the constraint into
  the schema from the foundational migration, not added later.
- **Balance-integrity risk**: the stored-balance-plus-reconciliation design (§7) requires the
  reconciliation job to actually be built and scheduled, or drift between stored balance and
  ledger sum could go unnoticed — named as required follow-up work, not optional polish.
- **`xp_reward` reuse risk** (§2d.1, §12, §34.2): now that reuse is approved, existing lesson data
  already has host-entered `xp_reward` values (e.g. 250, 220, 200 in the demo seed data) that
  become "live" progression inputs once the award RPC ships — mitigated by the approved ceiling
  clamp, but still worth a spot-check of real production lesson data's `xp_reward` values before
  Phase 11.3 sets the exact ceiling, to avoid an unintentional points/XP imbalance across existing
  lessons.

## 34. Owner decisions — all resolved

All seven decisions below were open at the end of Phase 11A's initial audit and are now
**approved by the product owner**. Phase 11.1 is unblocked. Each entry states the final rule and
carries forward into the decision log (§35, entries 11–17).

1. **Points vs. XP — resolved: kept separate.** Points and XP are independent values from day one,
   not numerically-identical aliases of one column. Points is the lifetime, non-spendable ranking
   score (never decremented, never spent). XP is a distinct progression input that feeds Level
   computation only. An event type's award-rule row may set a Points amount, an XP amount, both, or
   neither, independently.
2. **`lessons.xp_reward` reuse — resolved: reuse with a server-side ceiling.** The Lesson-completed
   award reads the lesson's own `xp_reward` value as its base amount, but the `award_progression_event`
   RPC clamps it to a platform-configured ceiling (`max_lesson_xp_award` in `progression_award_rules`)
   before crediting the member — the raw host-entered value is never awarded uncapped. The existing
   `lessons.xp_reward` column and its host-facing editor field are unchanged; the ceiling is enforced
   only at award time, not by constraining the column itself. The exact ceiling value is set at
   Phase 11.3 implementation time, after a spot-check of real production `xp_reward` values (§33).
3. **Member-cancellation refund cutoff — resolved: final rule below.**
   - A member receives a **full credit refund** when cancellation occurs **before**
     `church_experience_occurrences.registration_closes_at`.
   - If `registration_closes_at` is `null`, the cutoff falls back to `starts_at`.
   - Cancellation **at or after** the cutoff receives **no** member-cancellation refund.
   - **Church-initiated** occurrence cancellation still always receives a full automatic refund,
     unconditionally (§9, §10, §35 entry 6 — unaffected by this rule).
   - Every cutoff check happens **server-side**, inside the cancellation RPC, reading the
     occurrence's own stored `registration_closes_at`/`starts_at` columns directly. The client never
     computes, displays as authoritative, or authorizes a refund decision — it may only reflect
     back whatever the RPC actually decided.
4. **Ledger owner-reference shape — resolved: two explicit nullable FK columns.**
   `credit_ledger_entries` carries `member_wallet_id` and `church_wallet_id`, each a real foreign
   key to its own wallet table, with a `CHECK` constraint enforcing exactly one is non-null. No
   generic `wallet_type`/`wallet_id` pair is used, per the explicit direction against ambiguous
   polymorphic owner references (§6).
5. **`/dashboard`, `/badges`, `/leaderboard` — resolved: replace during Phase 11, not alongside
   duplicates.** `/dashboard` is retired outright at Phase 11.4, once real Wallet/Rewards/Badges/
   Leaderboard pages exist to replace what it showed — it is not kept as a slimmed-down summary
   page running alongside the new ones. `/badges` and `/leaderboard` keep their existing routes and
   have their data source swapped to real Supabase-backed tables at the same milestone, rather than
   standing up new pages at different paths next to the old mock ones.
6. **Church grant capacity — resolved: strictly bounded, no exceptions.** A church can only ever
   grant or approve up to its own wallet's real, current balance, checked atomically (row-locked)
   at grant/approval time. There is no separate platform "top-up allowance" concept beyond the
   wallet balance itself — the platform still funds a church wallet via its own `platform_grant`
   ledger entries (§6), but that is a distinct, earlier event from the grant-time check, never a
   bypass of it.
7. **Automatic credit-request expiration — resolved: none in v1.** `credit_requests` has no
   automatic expiration behavior and no `expired` status value. A request remains in
   `submitted`/`under_review` until a host acts (`approved`→`fulfilled` or `declined`) or the
   member cancels it themselves. No scheduled job is needed for this table in v1.

## 35. Decision log

| # | Decision | Rationale |
|---|---|---|
| 1 | Two explicit wallet tables (`member_wallets`, `church_wallets`), not one polymorphic table | Matches this repo's consistent preference for explicit, narrowly-scoped tables over generic/polymorphic ones (§6) |
| 2 | Stored `balance` column, synchronized transactionally with the ledger, plus a future reconciliation job | Best balance of query performance and correctness; mirrors Phase 10's occurrence-capacity locking pattern exactly (§7) |
| 3 | Trophies are a Badge category (`category = 'trophy'`), not a separate table, in v1 | Smallest coherent model per the brief's own instruction; a real trophy-specific need can still get its own table later without breaking this (§15) |
| 4 | Rewards are not a fourth standalone table; a narrow badge→credit join covers the one real need | Avoids a speculative generic-rewards-catalog table with no current inventory to catalog (§16) |
| 5 | Waitlisted registrations are not charged until promotion | Matches the brief's own suggested default; avoids holding a balance hostage for an uncertain seat (§9) |
| 6 | Church cancellation always fully refunds, no exceptions | The member did nothing wrong — not a policy choice (§9, §10) |
| 7 | "Event attended" as an XP trigger is deferred | Events has no attendance/registrant data model at all today — this would be speculative schema for a table that doesn't support it yet (§2a, §11) |
| 8 | Fixed, database-backed award-definitions table, not an open rule engine | Directly follows the brief's explicit instruction against an unrestricted v1 rule engine (§11, §12) |
| 9 | Global leaderboard ranks by lifetime Points, not XP or credits | Matches §4's definition of Points as the rank-driving, non-spendable score |
| 10 | Leaderboard pagination is included from v1 | Unlike Experience registrant lists, a Global leaderboard can genuinely grow platform-wide (§17) |
| 11 | Points and XP are independent values, not aliases of one column | Owner-approved, §34.1 — a Points-only or XP-only adjustment can never silently move the other |
| 12 | `lessons.xp_reward` is reused as the Lesson-completed award base amount, clamped to a platform-configured ceiling at award time | Owner-approved, §34.2 — honors real host input while preventing unrestricted host-entered values from creating unlimited XP |
| 13 | Member-cancellation refund cutoff is `registration_closes_at`, falling back to `starts_at` when null; church cancellation always fully refunds regardless | Owner-approved, §34.3 — exact final rule, enforced entirely server-side inside the cancellation RPC, never client-computed or client-authorized |
| 14 | `credit_ledger_entries` uses two explicit nullable FK columns (`member_wallet_id`, `church_wallet_id`) with a CHECK enforcing exactly one populated, not a generic `wallet_type`/`wallet_id` pair | Owner-approved, §34.4 — real FK enforcement per wallet type is only possible this way; avoids an ambiguous polymorphic reference |
| 15 | `/dashboard` is retired outright at Phase 11.4; `/badges` and `/leaderboard` are replaced in place (same routes, real data), not duplicated at new paths | Owner-approved, §34.5 — replace during Phase 11, never alongside a duplicate new page |
| 16 | Church grant/approval capacity is strictly bounded by the church wallet's real, current balance, with zero exceptions | Owner-approved, §34.6 — no separate top-up-allowance bypass of the grant-time balance check |
| 17 | Credit requests have no automatic expiration and no `expired` status in v1 | Owner-approved, §34.7 — no documented reason yet exists to justify the added complexity |

## 36. Explicit out-of-scope list (Phase 11, all sub-phases, unless separately approved later)

- Any Square code, credential, or webhook handler (§27 — extension points only).
- Any OpenAI/ChatGPT API call or credential (§28 — extension points only).
- A generic/polymorphic wallet table (§6, §35).
- Credit expiration (§7, §34.7).
- Event attendance/RSVP modeling and the resulting `event_spend`/"Event attended" trigger (§2a,
  §11, §35.7) — would need its own Events-phase schema work first.
- A physical-item reward fulfillment system (§16).
- Seasonal/time-boxed trophies (§15).
- An open, admin-configurable visual rule engine for points/XP/badges (§11, §12, explicit brief
  instruction).
- Any implementation code, migration, RPC, route, or component — this is an architecture/spec-only
  phase (Phase 11A). Implementation begins only in a subsequent, separately-approved phase per the
  roadmap in `docs/PHASE11_IMPLEMENTATION_PLAN.md`.
