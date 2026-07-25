# D5 — No option to edit the Profile — disposition, no code change

Trello: https://trello.com/c/1kP1xRou/45

**Status: intentionally deferred, reclassified. No code change made.**

## Background

`/profile` explicitly states: "Profile editing, avatar upload, and account settings connect to
production auth in Phase Two." No stubbed editing UI exists, and no TODO/FIXME markers reference it
-- this is documented, intentional scaffolding, consistent with this project's incremental
Supabase-migration rollout pattern (the same pattern behind D12 and D20 in this repair phase).

## Disposition

Per the repair plan's own recommendation and the owner's confirmation when Batch 5 was approved:
this is a documented feature gap, not a regression, and repair batches are for defects, not new
feature work. Real profile editing (name/avatar upload, account settings) would need a Supabase
Storage bucket for avatars and a dedicated update server action -- a real feature addition requiring
its own scoping pass, not a small fix bundled into this repair phase.

Reclassified as intentionally deferred rather than treated as an open defect. No code was changed
for D5.
