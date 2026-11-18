import assert from "node:assert/strict";
import { test } from "node:test";
import { createAiGateRequest, queuedRequestNeedsOwnCheck } from "./ai-gate-request";

test("a gate request settles once and ignores later answers", async () => {
  const request = createAiGateRequest("moderation");
  request.settle(false);
  request.settle(true);
  assert.equal(await request.promise, false);
});

test("a cancelled prompt answers queued requests that need the same key", () => {
  assert.equal(queuedRequestNeedsOwnCheck("moderation", false, "pdfMarkdown"), false);
  assert.equal(queuedRequestNeedsOwnCheck("voice", false, "voice"), false);
});

test("queued requests with a different key requirement still get their own prompt", () => {
  assert.equal(queuedRequestNeedsOwnCheck("voiceDocument", false, "voice"), true);
  assert.equal(queuedRequestNeedsOwnCheck("voice", false, "voiceDocument"), true);
});

test("after a ready answer or the settings dialog, queued requests are re-checked", () => {
  assert.equal(queuedRequestNeedsOwnCheck("moderation", true, "contentCorrection"), true);
  assert.equal(queuedRequestNeedsOwnCheck("settings", false, "moderation"), true);
});
