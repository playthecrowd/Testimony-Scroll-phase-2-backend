-- Phase 11.5: corrective rename for the one trigger name that exceeded Postgres's 63-byte
-- identifier limit and was silently truncated when first created (0033). Documented as a known,
-- harmless (fully functional -- confirmed live via pg_trigger, correctly attached and enabled)
-- cosmetic defect in docs/PHASE11_3_AUDIT.md SS11 and docs/PHASE11_4_AUDIT.md. Fixed now, per
-- Phase 11.5's own instruction to prefer a corrective migration over leaving it merely documented,
-- since a rename carries no behavioral risk: renaming a trigger does not affect what it does, only
-- what it's called, and the function it invokes
-- (award_progression_on_testimony_kingdom_scroll_publication) is untouched and was never itself
-- affected by the limit.
--
-- The live name today is the silently-truncated one Postgres actually created
-- ("...trigg", 63 characters) -- confirmed via a direct pg_trigger query before writing this
-- migration, not assumed from the original migration source's intended name.
alter trigger "award_progression_on_testimony_kingdom_scroll_publication_trigg"
  on public.testimonies
  rename to "testimony_kingdom_scroll_publication_trigger";
