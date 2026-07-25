import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Repair Batch 6, D17 (Trello UDTm1JgD): the homepage and /about jumped straight from <h1> to
// <h3> with no intervening <h2> (and on /about, an <h3> actually preceded an existing <h2>,
// reversing the order). Fixed by promoting the shared section-card/banner headings, and
// /about's InfoCard heading, from <h3> to <h2>.
const REPO_ROOT = path.join(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

test("D17: SectionCard's heading is an <h2>, not <h3>", () => {
  const source = read("components/ui/StatPill.tsx");
  assert.match(source, /<h2 className="text-sm font-semibold text-foreground flex items-center gap-2">/);
  assert.doesNotMatch(source, /<h3[^>]*>\s*\{Icon/);
});

test("D17: FeaturedEventBanner's heading is an <h2>, not <h3>", () => {
  const source = read("components/layout/FeaturedEventBanner.tsx");
  assert.match(source, /<h2[^>]*>\{featuredEvent\.title\}<\/h2>/);
});

test("D17: FeaturedScrollStrip's heading is an <h2>, not <h3>", () => {
  const source = read("components/layout/FeaturedScrollStrip.tsx");
  assert.match(source, /<h2[^>]*>Read real stories in the Kingdom Scroll<\/h2>/);
});

test("D17: /about's InfoCard heading is an <h2>, not <h3>, so it no longer precedes the page's own <h2> out of order", () => {
  const source = read("app/about/page.tsx");
  assert.match(source, /<h2 className="text-sm font-semibold text-foreground mb-1">\{title\}<\/h2>/);
  assert.doesNotMatch(source, /<h3/);
});
