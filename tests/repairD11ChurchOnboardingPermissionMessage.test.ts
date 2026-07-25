import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 7, D11 (Trello Mmkbnpbd): a Member who already belongs to a church, landing on
// /onboarding/church (reached via /host-dashboard/church-profile's redirect for non-hosts), saw
// "Only Church Host accounts can create a church." -- correct for a genuinely churchless
// non-host, but confusing/wrong for a Member of an existing church, who isn't trying to create
// one at all. Fixed by adding a distinct branch (not-host AND has churchId) with copy that
// matches this church of Member of an existing church, without touching the two existing checks
// (genuinely churchless non-host, and host-who-already-manages-a-church), which serve different
// populations and were already correct.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

function extractLogic() {
  const source = read("app/onboarding/church/page.tsx");
  return {
    source,
    signedOutIdx: source.indexOf('if (!session.isLoggedIn) {'),
    notHostIdx: source.indexOf('if (session.accountType !== "host") {'),
    memberWithChurchIdx: source.indexOf('if (session.user.churchId) {', source.indexOf('if (session.accountType !== "host") {')),
    memberWithChurchMsgIdx: source.indexOf('Only a Host or Admin of your church can edit its profile.'),
    genericNonHostMsgIdx: source.indexOf('Only Church Host accounts can create a church.'),
    hostWithChurchIdx: source.indexOf('You already manage a church.'),
  };
}

test("D11: signed-out visitors still see the sign-in prompt, checked before any account-type logic", () => {
  const { source, signedOutIdx, notHostIdx } = extractLogic();
  assert.notEqual(signedOutIdx, -1, "expected the signed-out branch to still exist");
  assert.match(source, /Sign in as a Church Host to complete setup\./);
  assert.ok(signedOutIdx < notHostIdx, "signed-out check must run before the account-type check");
});

test("D11: a Member who already belongs to a church gets a distinct access-denied message, not the 'create a church' prompt", () => {
  const { source, notHostIdx, memberWithChurchIdx, memberWithChurchMsgIdx, genericNonHostMsgIdx } = extractLogic();
  assert.notEqual(memberWithChurchIdx, -1, "expected a churchId check nested inside the non-host branch");
  assert.notEqual(memberWithChurchMsgIdx, -1, "expected the new distinct message to exist");
  assert.ok(
    notHostIdx < memberWithChurchIdx && memberWithChurchIdx < memberWithChurchMsgIdx,
    "the churchId check must be nested inside the non-host branch, and its message must follow it"
  );
  assert.ok(
    memberWithChurchMsgIdx < genericNonHostMsgIdx,
    "the member-with-a-church message must be checked/rendered before falling through to the generic 'create a church' message"
  );
  const messageRegion = source.slice(memberWithChurchMsgIdx, genericNonHostMsgIdx);
  assert.doesNotMatch(messageRegion, /create a church/i, "a member who already belongs to a church must not be told to create one");
});

test("D11: a genuinely churchless non-host (no churchId) still sees the original 'create a church' message, unchanged", () => {
  const { source, genericNonHostMsgIdx } = extractLogic();
  assert.notEqual(genericNonHostMsgIdx, -1);
  const region = source.slice(genericNonHostMsgIdx - 20, genericNonHostMsgIdx + 200);
  assert.match(region, /Go to Dashboard/);
});

test("D11: an authorized Host is unaffected -- a host who already manages a church still sees the original message, and a host with no church still reaches the setup form", () => {
  const { source, hostWithChurchIdx, notHostIdx } = extractLogic();
  assert.notEqual(hostWithChurchIdx, -1, "expected the existing host-already-manages-a-church branch to still exist");
  assert.ok(notHostIdx < hostWithChurchIdx, "the host-with-church check must remain its own branch, after the non-host branch resolves");
  assert.match(source, /Create Church Setup|Complete Church Setup/, "the host onboarding form must still be reachable for hosts with no church");
});
