import { ChurchExperience, ChurchExperienceOccurrence } from "@/types";

// Phase 11.2 (docs/PHASE11_ECONOMY_PROGRESSION_SPEC.md SS9, docs/PHASE11_2_AUDIT.md): pure
// mirror of the coalesce(occurrence.credit_cost, experience.default_credit_cost) logic the
// database's charge_credits_on_registration_confirmation trigger (0031) uses to decide the actual
// charge -- this is a read-only preview/display helper for a server action or page to show a
// member "this costs N credits" before registering, never the authority on what gets charged. The
// database trigger remains the only place a registration is actually charged; this function must
// never be used to decide whether to allow a registration client-side.
export function calculateExperienceCreditCost(
  experience: Pick<ChurchExperience, "defaultCreditCost">,
  occurrence: Pick<ChurchExperienceOccurrence, "creditCost">
): number | null {
  return occurrence.creditCost ?? experience.defaultCreditCost ?? null;
}

// True when the given balance covers the cost. A null/zero-or-less cost is always affordable
// (free). Also a preview-only helper -- the database trigger is still the real gate.
export function hasSufficientBalanceForCost(balance: number, cost: number | null): boolean {
  if (cost == null || cost <= 0) return true;
  return balance >= cost;
}
