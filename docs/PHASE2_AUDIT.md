# Phase 2 — Church Operations

Date: 2026-07-17. Builds directly on `docs/PHASE1_AUDIT.md`'s findings (host-dashboard now real,
`private.is_church_manager` is the consistent RLS gate for every church-scoped table).

## Scope delivered

1. **Church Profile** (`app/host-dashboard/church-profile/`): editable name, description,
   address, city/region/country, website, contact email/phone, church type/tradition, logo/banner
   image URLs. Ministries are shown (reusing the existing `ministries` table) but not editable
   here -- they're still created via the lesson builder's find-or-create, as before.
2. **Church Member Management** (`app/host-dashboard/members/`): real member roster, invite-by-
   email, bulk CSV/paste import, a generic join link + QR code, and a pending-invites list with
   revoke.
3. **Public Church Page** (`app/churches/[churchId]/page.tsx`): now shows the new profile fields,
   ministries, and a "Share This Church" card (same join link/QR the host sees).
4. **Join flow**: `/join/[churchSlug]` (generic link/QR) and `/join/invite/[token]` (individual
   invite redemption).

## Decisions made

- **Invite delivery**: confirmed with the user -- real `church_invites` records are created and
  the host is given a real, copyable per-invite link (`/join/invite/[token]`); the app does not
  send email itself. No third-party email service or verified Supabase SMTP config exists in this
  environment, so promising automatic delivery would have been dishonest. This can be upgraded
  later to actually email the link (e.g. via Supabase Auth's `inviteUserByEmail` or a real email
  provider) without changing the schema.
- **Multi-church membership**: the schema already permits a profile to belong to multiple
  churches (`unique (church_id, profile_id)` on `church_memberships`, no uniqueness on
  `profile_id` alone). Phase 2 does not add a restriction -- a member can join more than one
  church's community, consistent with the existing model. A host is still assumed to actively
  manage one church at a time in the UI (see Phase 1's "first church" note); that limitation is
  unchanged.
- **QR codes**: rendered via a public QR-generation image URL (`lib/images.ts`'s new `qrCode()`),
  the same "external image URL, no new dependency" pattern already used by `photo()`/`avatar()`.
  No new npm dependency was added for this.
- **CSV import**: hand-rolled comma/newline/semicolon splitting + a plain email regex
  (`app/host-dashboard/members/actions.ts`), not a CSV parsing library -- the only supported
  format is "one email per line or comma-separated," which doesn't need one.
- **Public contact info**: `contact_email`/`contact_phone`/`website`/`church_type`/`address_line1`
  are shown on the public church page. These are church-level fields the host explicitly enters
  for public display (like a business's public contact info), not the host's personal account --
  `profiles` (the host's actual account data) is never joined into or exposed by the public church
  page.
- **`churches.member_count` sync**: discovered while wiring the public page that this column was
  never kept in sync with real membership (only ever set by demo seeding). `0013_church_member_count_sync.sql`
  adds an AFTER INSERT/DELETE trigger on `church_memberships` plus a one-time backfill, since a
  public visitor has no RLS right to count `church_memberships` directly (that's deliberately
  manager-only, 0009) -- the public page has to rely on this column being accurate now.

## Migrations added

| # | File | Purpose |
|---|---|---|
| 0010 | `0010_church_profile_fields.sql` | New church columns: address_line1, website, contact_email, contact_phone, church_type, banner_url |
| 0011 | `0011_church_invites.sql` | `church_invites` table + RLS + `accept_church_invite` SECURITY DEFINER RPC |
| 0012 | `0012_church_members_profile_read.sql` | Additive `profiles` SELECT policy so a church manager can read their members' names/emails |
| 0013 | `0013_church_member_count_sync.sql` | Trigger + backfill to keep `churches.member_count` accurate |

All four follow the existing additive-policy pattern (never weaken an existing policy, gate new
access through `private.is_church_manager`) established in Phase 1's `0009`.

## Not built (explicitly out of scope, per the prompt's phase plan)

- Editing ministries from the church profile UI (still lesson-builder-driven find-or-create)
- Actually sending invite emails (see decision above)
- Removing/changing a member's role from the member list (only invite + view were requested)
- Church category as a fixed enum -- `church_type` is free text with `<datalist>` suggestions,
  since denominations/traditions vary too widely to constrain at the schema level

## Manual QA checklist

1. As a host, open `/host-dashboard/church-profile`, edit every field, save, confirm the public
   `/churches/[slug]` page reflects the changes (website link, contact info, address, ministries).
2. Confirm a Kingdom Member (not a manager of this church) **cannot** load
   `/host-dashboard/church-profile` or `/host-dashboard/members` for someone else's church directly
   by URL -- and that submitting the update action for a church they don't manage fails.
3. On `/host-dashboard/members`: copy the share link, open it in a private/incognito window signed
   in as a different Kingdom Member account, confirm they can join, and that they now appear in the
   member list.
4. Send an individual email invite, copy its `/join/invite/[token]` link, redeem it as a different
   signed-in account, confirm it moves from "Pending" to no longer listed (accepted) and the
   invitee appears in the member list.
5. Attempt to redeem the same invite token a second time -- confirm it's rejected ("already been
   used or was revoked").
6. Revoke a pending invite, then attempt to redeem its link -- confirm it's rejected.
7. Bulk-paste a mix of valid and invalid-looking email strings into the CSV importer -- confirm
   valid ones become pending invites and invalid ones are reported back, not silently dropped or
   silently accepted.
8. Confirm `churches.member_count` (and the number shown on `/churches/[slug]`) increases after a
   join and stays correct after several joins from different accounts.
