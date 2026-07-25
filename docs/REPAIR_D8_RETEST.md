# D8 — "Save Draft" on the Edit Lesson page — retest finding, no code change

Trello: https://trello.com/c/ttxKjv0d/49

**Status: does not reproduce on the current deployed build. No code change made.**

## Background

During repair planning, static code review of `EditExperienceForm.tsx` found that the "Save Draft"
and "Save Changes" buttons share the exact same `handleSave` function, with no separate or
differently-behaving code path for a Draft-status lesson. No branching bug could be found to
explain the originally-reported silent no-op. The plan flagged this defect as requiring a live
re-test against the real deployed app before writing any fix, and specified: "If it does not
reproduce, close as a stale-build false alarm with the repro evidence attached to the card."

## Retest (2026-07-24, commit d5cbba3, Church A Host, production.quest4thekingdom.com)

1. Opened the Draft-status lesson "QA Draft Visibility Test" at
   `/experience-builder/qa-draft-visibility-test/edit`.
2. Changed the Lesson Title field.
3. Clicked "Save Draft".

**Result:** a real save fired, "Lesson changes saved successfully." was shown, and the change
persisted — confirmed via a direct database query (`title` and `updated_at` both reflect the
change) and again via a completely fresh page reload (not just optimistic client-side state).

## Conclusion

The defect does not reproduce. Consistent with the plan's own reasoning, this is treated as a
stale-build artifact from the original QA pass (or a data-specific condition on that specific pass
that no longer applies) rather than a real, ongoing code defect. No code was changed for D8 — there
is nothing in the current `EditExperienceForm.tsx`/`lib/lessonStatus.ts` for this fix to have
touched, since the symmetric `handleSave` path was already correct.
