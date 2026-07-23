import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Phase Batch 1, D1 (High): AuthScreen had no error handling for unexpected sign-in/sign-up
// exceptions -- any thrown error left `submitting` stuck true forever with no visible feedback.
// Trello: https://trello.com/c/pthIcqkL/41
//
// Structural guard here. Genuine behavioral coverage (a real thrown exception, no mocking -- this
// repo has no .env.local locally, so createClient() throws for real) was separately verified via
// an ad-hoc local Playwright run against the dev server; that file was not committed since
// @playwright/test isn't a permanent project dependency (see npm run build's clean-install
// requirement -- tsconfig.json's include globs the whole repo, so any committed .ts file importing
// an uninstalled package breaks the production build's typecheck).
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

test("D1: handleSignIn wraps signIn() in try/catch/finally so an unexpected exception always resets submitting and shows an error", () => {
  const source = read("components/auth/AuthScreen.tsx");
  const body = extractFunctionBody(source, "async function handleSignIn(");

  const tryIdx = body.indexOf("try {");
  const catchIdx = body.indexOf("} catch");
  const finallyIdx = body.indexOf("} finally {");
  assert.notEqual(tryIdx, -1, "handleSignIn must wrap its logic in a try block");
  assert.notEqual(catchIdx, -1, "handleSignIn must have a catch block");
  assert.notEqual(finallyIdx, -1, "handleSignIn must have a finally block");
  assert.ok(tryIdx < catchIdx && catchIdx < finallyIdx, "expected try, then catch, then finally in order");

  const catchBody = body.slice(catchIdx, finallyIdx);
  assert.match(catchBody, /setError\(/, "catch block must set a user-visible error message on an unexpected exception");

  const finallyBody = body.slice(finallyIdx);
  assert.match(finallyBody, /setSubmitting\(false\)/, "finally block must always reset submitting state, even on a thrown exception");
});

test("D1: handleSignUp wraps signUp() in try/catch/finally so an unexpected exception always resets submitting and shows an error", () => {
  const source = read("components/auth/AuthScreen.tsx");
  const body = extractFunctionBody(source, "async function handleSignUp(");

  const tryIdx = body.indexOf("try {");
  const catchIdx = body.indexOf("} catch");
  const finallyIdx = body.indexOf("} finally {");
  assert.notEqual(tryIdx, -1, "handleSignUp must wrap its logic in a try block");
  assert.notEqual(catchIdx, -1, "handleSignUp must have a catch block");
  assert.notEqual(finallyIdx, -1, "handleSignUp must have a finally block");
  assert.ok(tryIdx < catchIdx && catchIdx < finallyIdx, "expected try, then catch, then finally in order");

  const catchBody = body.slice(catchIdx, finallyIdx);
  assert.match(catchBody, /setError\(/, "catch block must set a user-visible error message on an unexpected exception");

  const finallyBody = body.slice(finallyIdx);
  assert.match(finallyBody, /setSubmitting\(false\)/, "finally block must always reset submitting state, even on a thrown exception");

  // Preserve pre-existing behavior: a handled { error } result and the "check-email" branch must
  // both still work exactly as before (return inside try is fine -- finally still runs).
  assert.match(body, /if \(result\.status === "check-email"\)/, "must preserve the check-email branch");
});
