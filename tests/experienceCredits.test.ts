import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateExperienceCreditCost, hasSufficientBalanceForCost } from "../lib/experienceCredits";

// Phase 11.2: pure-function unit tests, matching this repo's existing plain-function unit-test
// style (tests/experienceTimezone.test.ts precedent).

test("calculateExperienceCreditCost: occurrence cost overrides the Experience default when set", () => {
  const cost = calculateExperienceCreditCost({ defaultCreditCost: 50 }, { creditCost: 75 });
  assert.equal(cost, 75);
});

test("calculateExperienceCreditCost: falls back to the Experience default when the occurrence has none", () => {
  const cost = calculateExperienceCreditCost({ defaultCreditCost: 50 }, { creditCost: null });
  assert.equal(cost, 50);
});

test("calculateExperienceCreditCost: null when neither the occurrence nor the Experience sets a cost (free)", () => {
  const cost = calculateExperienceCreditCost({ defaultCreditCost: null }, { creditCost: null });
  assert.equal(cost, null);
});

test("hasSufficientBalanceForCost: a null cost (free) is always affordable regardless of balance", () => {
  assert.equal(hasSufficientBalanceForCost(0, null), true);
});

test("hasSufficientBalanceForCost: a zero-or-negative cost is treated as free", () => {
  assert.equal(hasSufficientBalanceForCost(0, 0), true);
  assert.equal(hasSufficientBalanceForCost(0, -5), true);
});

test("hasSufficientBalanceForCost: balance exactly equal to cost is sufficient", () => {
  assert.equal(hasSufficientBalanceForCost(50, 50), true);
});

test("hasSufficientBalanceForCost: balance below cost is insufficient", () => {
  assert.equal(hasSufficientBalanceForCost(49, 50), false);
});
