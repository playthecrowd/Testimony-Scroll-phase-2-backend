import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bytesMatchSignature,
  detectImageSignatureError,
  validateThumbnailFileBytes,
  THUMBNAIL_MAX_BYTES,
} from "../lib/lessonThumbnail";

// Repair Batch 2, D21 (Trello FS5mWbvB): a file with a spoofed image MIME type but non-image bytes
// (e.g. a renamed text file) passed the old declared-type-only check and rendered as a broken
// image with no error. These are TRUE TESTS -- real File/Blob objects (Node's native
// implementation, no mocking) with real byte content, exercising the actual async validation
// function end to end, not source scans.
//
// See lib/lessonThumbnail.ts's trusted-boundary note: this validation runs client-side because the
// upload path (services/supabase/lessonThumbnails.ts) goes browser-to-storage directly with no
// server-side re-check -- these tests confirm the *logic* is correct, not that it is unbypassable.

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
// "RIFF" + 4 bytes size (arbitrary) + "WEBP"
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const TEXT_BYTES = new TextEncoder().encode("Hello, this is a plain text file, not an image.");
const EXE_BYTES = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]); // Windows PE "MZ" header

function makeFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([Buffer.from(bytes)], name, { type });
}

// ---------------------------------------------------------------------------
// Pure signature-matching helper
// ---------------------------------------------------------------------------

test("[TRUE TEST] bytesMatchSignature matches at offset 0 and at a given offset, and rejects a too-short buffer", () => {
  assert.equal(bytesMatchSignature(PNG_BYTES, [0x89, 0x50, 0x4e, 0x47]), true);
  assert.equal(bytesMatchSignature(WEBP_BYTES, [0x57, 0x45, 0x42, 0x50], 8), true);
  assert.equal(bytesMatchSignature(new Uint8Array([0x89, 0x50]), [0x89, 0x50, 0x4e, 0x47]), false, "buffer shorter than the signature must fail, not throw");
  assert.equal(bytesMatchSignature(new Uint8Array(0), [0x89]), false, "an empty buffer must fail cleanly");
});

// ---------------------------------------------------------------------------
// detectImageSignatureError: declared type vs. real bytes
// ---------------------------------------------------------------------------

test("[TRUE TEST] detectImageSignatureError accepts real PNG/JPEG/WEBP bytes matching their declared type", () => {
  assert.equal(detectImageSignatureError(PNG_BYTES, "image/png"), null);
  assert.equal(detectImageSignatureError(JPEG_BYTES, "image/jpeg"), null);
  assert.equal(detectImageSignatureError(WEBP_BYTES, "image/webp"), null);
});

test("[TRUE TEST] detectImageSignatureError rejects real PNG bytes declared as a different type, and vice versa (proves it checks bytes, not just the label)", () => {
  assert.notEqual(detectImageSignatureError(PNG_BYTES, "image/jpeg"), null);
  assert.notEqual(detectImageSignatureError(JPEG_BYTES, "image/png"), null);
  assert.notEqual(detectImageSignatureError(WEBP_BYTES, "image/png"), null);
});

test("[TRUE TEST] detectImageSignatureError's WEBP check verifies both the RIFF header AND the WEBP marker at offset 8, not just RIFF alone", () => {
  const riffButNotWebp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]); // "RIFF"...."AVI "
  assert.notEqual(detectImageSignatureError(riffButNotWebp, "image/webp"), null, "a RIFF container that isn't WEBP (e.g. AVI) must still be rejected");
});

// ---------------------------------------------------------------------------
// validateThumbnailFileBytes: full end-to-end async validation against real File objects
// ---------------------------------------------------------------------------

test("[TRUE TEST] valid PNG file passes", async () => {
  assert.equal(await validateThumbnailFileBytes(makeFile(PNG_BYTES, "photo.png", "image/png")), null);
});

test("[TRUE TEST] valid JPEG file passes", async () => {
  assert.equal(await validateThumbnailFileBytes(makeFile(JPEG_BYTES, "photo.jpg", "image/jpeg")), null);
});

test("[TRUE TEST] valid WEBP file passes (RIFF/WEBP signature check)", async () => {
  assert.equal(await validateThumbnailFileBytes(makeFile(WEBP_BYTES, "photo.webp", "image/webp")), null);
});

test("[TRUE TEST] plain text file renamed to .png with a spoofed image/png type is rejected -- the original QA repro", async () => {
  const error = await validateThumbnailFileBytes(makeFile(TEXT_BYTES, "photo.png", "image/png"));
  assert.notEqual(error, null);
  assert.match(error!, /doesn't look like a real PNG/);
});

test("[TRUE TEST] executable bytes with a spoofed image MIME type are rejected", async () => {
  const error = await validateThumbnailFileBytes(makeFile(EXE_BYTES, "photo.png", "image/png"));
  assert.notEqual(error, null);
});

test("[TRUE TEST] truncated image header (fewer bytes than the real signature needs) is rejected, not treated as valid or thrown", async () => {
  const truncated = PNG_BYTES.slice(0, 3); // real PNG bytes, but cut short before the signature completes
  const error = await validateThumbnailFileBytes(makeFile(truncated, "photo.png", "image/png"));
  assert.notEqual(error, null);
});

test("[TRUE TEST] oversized otherwise-valid image is rejected on size, independent of the byte-signature check", async () => {
  const oversized = new Uint8Array(THUMBNAIL_MAX_BYTES + 1);
  oversized.set(PNG_BYTES, 0); // real, valid PNG signature at the start -- only the size is wrong
  const error = await validateThumbnailFileBytes(makeFile(oversized, "big.png", "image/png"));
  assert.notEqual(error, null);
  assert.match(error!, /5 MB or smaller/);
});

test("[TRUE TEST] unsupported declared format is rejected before any byte reading is attempted", async () => {
  const error = await validateThumbnailFileBytes(makeFile(new Uint8Array([0x47, 0x49, 0x46, 0x38]), "photo.gif", "image/gif"));
  assert.notEqual(error, null);
  assert.match(error!, /JPEG, PNG, or WEBP/);
});

test("[TRUE TEST] empty file is rejected, not treated as valid", async () => {
  const error = await validateThumbnailFileBytes(makeFile(new Uint8Array(0), "empty.png", "image/png"));
  assert.notEqual(error, null);
});
