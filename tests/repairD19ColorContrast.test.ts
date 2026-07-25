import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D19 (Trello MLHCuziM): --accent-blue paired with white text measured ~3.82:1,
// below the 4.5:1 WCAG AA threshold for normal text. Owner selected #1f66e0 (5.20:1) from 3
// candidates. [TRUE TEST] computes the actual WCAG relative-luminance contrast ratio rather than
// just asserting the new hex string is present, so it fails if a future edit reintroduces a
// non-compliant value under the same variable name.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

test("D19: --accent-blue against white text meets WCAG AA (>= 4.5:1) for normal text", () => {
  const source = read("app/globals.css");
  const match = source.match(/--accent-blue:\s*(#[0-9a-fA-F]{6});/);
  assert.ok(match, "expected to find --accent-blue in app/globals.css");
  const ratio = contrastRatio(match![1], "#ffffff");
  assert.ok(ratio >= 4.5, `expected contrast ratio >= 4.5:1, got ${ratio.toFixed(2)}:1`);
});
