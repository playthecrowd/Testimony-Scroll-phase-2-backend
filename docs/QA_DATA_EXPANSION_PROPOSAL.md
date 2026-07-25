# Proposal: QA Test-Data Expansion Beyond the Baseline Five Users

**Status: proposal only. Nothing in this document has been implemented or provisioned.** It exists
so the shape and feasibility of each remaining Trello-relevant data state can be reviewed before
any of it is built, per instruction not to implement this expansion yet.

`scripts/qaSeed.ts` currently provisions: five Auth users, two churches, host/member/platform-admin
roles, and a baseline wallet state (Church A Member funded, Church B Member at zero; Church A
wallet funded, Church B wallet at zero). Everything below is what the full Trello testing program
still needs and does not yet exist.

## Two fundamentally different mechanisms, not one

This matters for scoping effort correctly:

**Mechanism A — direct RPC call, admin- or identity-authenticated (what `qaSeed.ts` already does).**
Fast, deterministic, no browser needed. Available wherever the schema exposes a real RPC that can
set the state directly (e.g. `grant_credits`, `create_church_with_host`).

**Mechanism B — drive the app's real workflow end-to-end.** Required wherever *no* admin RPC exists
to set a state directly — most notably **all of Progression** (points/XP/badges). I confirmed
during the earlier schema audit that `private.award_progression_event` is internal-only, never
granted to `authenticated`, and only fires from triggers on real activity (a lesson journey
reaching `studied`, an Experience registration completing, a testimony being submitted/approved).
There is no "just set this member's XP to 500" RPC, by design — the only way to produce a
non-zero/non-default progression state is to actually complete the corresponding real action as
that QA identity (sign in, call the same server actions a real member's browser would call, or
drive a headless browser through the actual UI). This is a materially larger, differently-shaped
piece of work than extending `qaSeed.ts` with a few more RPC calls, and needs its own design pass.

## Proposed states, by area

### Lessons
- **Mechanism A.** `submit_lesson_draft` RPC (0003), called authenticated as a QA host, produces a
  draft lesson. A follow-up `update lessons set status='published'` (host-authenticated, RLS
  allows a manager) or the app's own publish action produces a published one. Straightforward
  extension of `qaSeed.ts`'s existing pattern (create-authenticated-as-host).

### Journeys
- **No-journey state**: the default — a QA member who hasn't started one. No action needed.
- **In-progress state**: **Mechanism A**, mostly — `lesson_journeys` rows can be created directly
  (member-authenticated insert, matching the app's own "Start Your Journey" write), with
  `lesson_journey_items` left incomplete.
- **Completed-Studied state**: **Mechanism A** for the row states themselves, but reaching
  `current_stage = 'studied'` for real (not just setting the column) is what triggers a
  progression award via `sync_...`/`award_progression_event`-adjacent triggers — so this state
  *also* produces a progression side-effect, which is desirable (it's the only way to get a
  non-zero progression state at all — see Progression below) but means this can't be provisioned
  by the service-role client bypassing the real flow without also bypassing the progression award,
  which would leave the data in an inconsistent state a real user could never reach. Needs to be
  done via the member's own authenticated session calling whatever the real "mark studied" action
  calls, not a raw admin insert.
- **Duplicate-completion state**: exercised by attempting the "mark studied" action twice as the
  same QA member — a test *procedure*, not persisted seed data.

### Experiences
- **Free / paid / default-price / occurrence-price-override**: **Mechanism A.** `church_experiences`
  and `church_experience_occurrences` rows created host-authenticated (mirroring
  `app/host-dashboard/experiences/actions.ts`'s `createExperienceAction`/`createOccurrenceAction`,
  already audited earlier this session), varying `default_credit_cost`/`credit_cost`.
- **Available / full / waitlist occurrence**: **Mechanism A** for available; full/waitlist need
  enough registration rows to hit `max_capacity` (need to confirm the exact capacity column/check
  from `0022_church_experiences.sql` — not yet read in this pass) — straightforward once that's
  confirmed, via the `register_for_experience_occurrence` RPC called as additional throwaway QA-
  adjacent registrants, or by setting a very low capacity on a QA-only occurrence and registering
  the two QA members against it.
- **Confirmed / refundable / nonrefundable registration**: **Mechanism A** via
  `register_for_experience_occurrence` (member-authenticated) and `refund_credits` (admin- or
  host-authenticated, per its own gating already documented in the earlier schema audit).

### Progression (points, XP, level thresholds, badges, leaderboard)
- **Zero state**: the default for a brand-new profile — already true today for both QA members,
  no action needed (confirmed: `member_progression_summaries` has no row until the first real
  award, and the dashboard already treats a missing row as zero).
- **Existing Points/XP state, level-threshold state, badge earned state**: **Mechanism B only** —
  requires actually completing real trigger-generating actions as a QA member (e.g. driving the
  Journey "Studied" flow above, submitting/getting a testimony approved, completing an Experience
  registration) enough times to cross a specific level threshold or badge's `threshold`/
  `requirement_type`. This needs its own small design: which specific sequence of real actions,
  performed as which QA identity, reaches which specific badge/level deterministically. Proposing
  to design this as a short "QA activity script" that drives the real actions (via authenticated
  RPC/server-action calls, not a headless browser, since everything on the progression path is
  already RPC/server-action reachable) rather than a browser-automation script.
- **Badge unearned state**: the default for any badge the above sequence doesn't trigger — no
  action needed, just don't drive that specific action for that identity.
- **Leaderboard-suitable member**: a side effect of the above (any member with a nonzero
  `points_total` appears on `leaderboard_global`/`leaderboard_my_church`).
- **Privacy opt-out state**: **Mechanism A** — `member_progression_summaries.leaderboard_opt_out`
  is a plain column; need to confirm whether any RPC lets a member set it themselves or whether
  it's a direct authenticated update (not yet checked in this pass).

### Testimonies / Kingdom Scroll
- **Submission**: **Mechanism A** — likely a direct `testimonies` insert or dedicated RPC (not yet
  located/confirmed in this pass) authenticated as a QA member, referencing a QA lesson.
- **Church-approved / platform-approved (Kingdom Scroll) states**: **Mechanism A**, church-approval
  via QA host, platform-approval via QA platform admin — both are just status-column transitions
  per the two-stage `church_status`/`platform_status` design already documented in the schema
  audit, presumably each gated by its own RPC or a direct authenticated update (needs confirming
  which).
- **Reward-history / duplicate-reward-prevention states**: a consequence of the testimony-approval
  trigger from Progression above (`progression_award_log`'s `unique(member_id, event_type,
  source_row_id)` already guards duplicates at the schema level) — testable by approving the same
  testimony's progression-triggering transition twice and confirming no second award, once the
  underlying testimony flow exists.

### Dashboard empty/loading/data states
- Empty state: the default (a fresh QA member/host before any of the above runs).
- Data state: a side effect of everything else above existing.
- Loading state: not a data-provisioning concern — a QA/manual browser-testing concern (throttle
  network, or observe the real loading skeleton), out of scope for a seed script.

## What I'd need to confirm before implementing any of this

A handful of exact RPC/column names I haven't yet read in this session (Experience capacity
column/check, testimony submission RPC name, leaderboard opt-out write path) — a short, bounded
follow-up read of `supabase/migrations/0015`, `0018`, `0022`–`0026` would close these gaps before
writing any code, same rigor as the audit `qaSeed.ts`/`qaCleanup.ts` were built against.

## Proposed shape of the actual deliverable (not yet built)

- Extend `scripts/qaSeed.ts` with the Mechanism-A pieces (lessons, journeys' row-level states,
  Experiences, most of testimonies) as additional, clearly-labeled, individually-idempotent
  functions — same guard rails, same "never touch anything outside the 5 QA identities/2 QA
  churches" discipline already in place.
- A separate, smaller script (or a clearly-separated section) for the Mechanism-B
  progression-triggering sequence, since it's conceptually different work (driving real actions,
  not just inserting rows) and should be reviewable as its own unit.
- Extend `scripts/qaCleanup.ts`'s manifest/deletion coverage to match whatever new tables the
  above touches (it already has correct FK-cascade coverage for lessons/journeys/experiences/
  testimonies from the original FK audit — the church/profile cascade already reaches them, so
  cleanup likely needs no changes at all here, only the dry-run manifest's `buildManifest()` might
  want additional itemized rows for visibility, which is a documentation nicety, not a safety
  requirement).

Waiting for direction before implementing any part of this.
