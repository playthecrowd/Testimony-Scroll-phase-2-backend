import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Phase Batch 1, D10 (High): "Sign Out" intermittently failed to invalidate the session --
// the client fired `logout()` without awaiting it, then immediately navigated via
// `window.location.href`, which could abort the in-flight POST /auth/v1/logout request before it
// completed. A shared-device user could believe they'd signed out while the previous session
// stayed live.
// Trello: https://trello.com/c/WNvpQ1uX/52
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `expected to find "${signature}"`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart + 1, i);
    }
  }
  throw new Error(`unbalanced braces reading body of "${signature}"`);
}

test("D10: SessionContext's logout() is async and awaits signOut() before refresh(), and its type is Promise<void>", () => {
  const source = read("context/SessionContext.tsx");
  assert.match(
    source,
    /logout: \(\) => Promise<void>;/,
    "SessionContextValue.logout must be typed as returning Promise<void> so callers can await it"
  );
  const body = extractFunctionBody(source, "const logout = useCallback(async () => ");
  assert.match(body, /await authSignOut\(\)/, "logout must await the real signOut call, not fire-and-forget it");
  assert.match(body, /await refresh\(\)/, "logout must await refresh() after signOut completes");
  const signOutIdx = body.indexOf("await authSignOut()");
  const refreshIdx = body.indexOf("await refresh()");
  assert.ok(signOutIdx < refreshIdx, "signOut must be awaited before refresh runs");
});

test("D10: authService.signOut() throws on a Supabase-reported error instead of silently discarding it", () => {
  const source = read("services/authService.ts");
  const body = extractFunctionBody(source, "export async function signOut(): Promise<void> ");
  assert.match(body, /const \{ error \} = await supabase\.auth\.signOut\(\)/, "must capture the error field from the real signOut call");
  assert.match(body, /if \(error\) throw error;/, "must throw on a real sign-out failure so callers (logout()) can detect and surface it");
});

test("D10: AccountMenu's Sign Out handler awaits logout(), guards against concurrent clicks, and only navigates on success", () => {
  const source = read("components/layout/AccountMenu.tsx");
  const body = extractFunctionBody(source, "async function handleSignOut() ");

  assert.match(body, /if \(signingOut\) return;/, "must guard against re-entrant clicks while a logout is already in flight");

  const tryIdx = body.indexOf("try {");
  const catchIdx = body.indexOf("} catch {");
  assert.notEqual(tryIdx, -1, "handleSignOut must wrap logout() in a try block");
  assert.notEqual(catchIdx, -1, "handleSignOut must have a catch block for a rejected logout()");

  const tryBody = body.slice(tryIdx, catchIdx);
  const awaitIndex = tryBody.indexOf("await logout();");
  const navigateIndex = tryBody.indexOf('window.location.href = "/";');
  assert.notEqual(awaitIndex, -1, "must await logout() before navigating");
  assert.notEqual(navigateIndex, -1, "expected a navigation to / on success, inside the try block (not before it)");
  assert.ok(awaitIndex < navigateIndex, "navigation must happen only after logout() resolves, not before/concurrently");

  const catchBody = body.slice(catchIdx);
  assert.match(catchBody, /setSignOutError\(/, "on failure, must surface a visible error rather than silently appearing signed out");
  assert.match(catchBody, /setSigningOut\(false\)/, "on failure, must reset signingOut so the button isn't permanently disabled");

  // The button itself must be disabled while signingOut, so a second click can't start a second
  // concurrent logout() call even if a user manages to click before React re-renders.
  const buttonRegion = source.slice(source.indexOf("onClick={handleSignOut}"), source.indexOf("onClick={handleSignOut}") + 300);
  assert.match(buttonRegion, /disabled=\{signingOut\}/, "Sign Out button must be disabled while signingOut is true");
});
