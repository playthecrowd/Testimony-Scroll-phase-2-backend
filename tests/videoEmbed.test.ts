import { test } from "node:test";
import assert from "node:assert/strict";
import { getYouTubeEmbedUrl } from "../lib/videoEmbed";

test("youtube.com/watch?v= converts to an embed URL", () => {
  assert.equal(getYouTubeEmbedUrl("https://www.youtube.com/watch?v=abc123"), "https://www.youtube.com/embed/abc123");
});

test("youtu.be/ short links convert to an embed URL", () => {
  assert.equal(getYouTubeEmbedUrl("https://youtu.be/abc123"), "https://www.youtube.com/embed/abc123");
});

test("youtube.com/shorts/ converts to an embed URL", () => {
  assert.equal(getYouTubeEmbedUrl("https://www.youtube.com/shorts/abc123"), "https://www.youtube.com/embed/abc123");
});

test("an already-embed URL passes through unchanged", () => {
  assert.equal(getYouTubeEmbedUrl("https://www.youtube.com/embed/abc123"), "https://www.youtube.com/embed/abc123");
});

test("a non-YouTube URL returns null (caller falls back to a plain link)", () => {
  assert.equal(getYouTubeEmbedUrl("https://example.com/video.mp4"), null);
});

test("a malformed URL returns null rather than throwing", () => {
  assert.equal(getYouTubeEmbedUrl("not a url"), null);
});
