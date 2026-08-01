import { AccountType } from "@/types";

// Single shared source for "does this account type get the manager (Church/Organization) surface,
// or the Member one" -- same reasoning as lib/navigation.ts's hostOnly flag: two call sites
// deciding this independently is how they drift. A binary accountType === "host" check would
// silently fall an Organization account through to Member behavior, since Organization is a third,
// sibling value, not a synonym for either existing one -- every former host-only gate must call
// this instead of comparing to "host" directly.
export function isEntityManagerAccountType(accountType: AccountType): boolean {
  return accountType === "host" || accountType === "organization";
}
