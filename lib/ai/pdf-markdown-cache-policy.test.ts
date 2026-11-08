import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReplacePdfMarkdownGeneration,
  getPdfMarkdownFeedbackTtlSeconds,
  resolvePdfMarkdownCacheMode,
} from "./pdf-markdown-cache-policy";

test("only moderators can bypass a served generation", () => {
  assert.equal(resolvePdfMarkdownCacheMode("refresh", "MODERATOR"), "refresh");
  assert.equal(resolvePdfMarkdownCacheMode("refresh", "USER"), "default");
  assert.equal(resolvePdfMarkdownCacheMode("refresh", undefined), "default");
  assert.equal(resolvePdfMarkdownCacheMode(undefined, "MODERATOR"), "default");
});

test("a writer replaces only the generation it observed", () => {
  // Nothing stored: any writer may fill the entry.
  assert.equal(canReplacePdfMarkdownGeneration(null, null), true);
  assert.equal(canReplacePdfMarkdownGeneration(null, "flagged"), true);
  // A writer that saw no entry must not replace one written meanwhile.
  assert.equal(canReplacePdfMarkdownGeneration("fresh", null), false);
  // A writer replacing a flagged generation keeps a newer one.
  assert.equal(canReplacePdfMarkdownGeneration("flagged", "flagged"), true);
  assert.equal(canReplacePdfMarkdownGeneration("fresh", "flagged"), false);
  // A moderator refresh replaces whatever is stored.
  assert.equal(canReplacePdfMarkdownGeneration("fresh", undefined), true);
});

test("feedback expires with the generation it describes", () => {
  const day = 24 * 60 * 60;
  const generatedAt = "2026-01-01T00:00:00.000Z";
  const generatedAtMs = Date.parse(generatedAt);
  const ttl = (now: number) =>
    getPdfMarkdownFeedbackTtlSeconds({ entryTtlSeconds: 30 * day, generatedAt, now });

  assert.equal(ttl(generatedAtMs), 30 * day);
  // Votes cast at different times share one absolute expiry.
  const laterVote = generatedAtMs + 10 * day * 1000;
  assert.equal(laterVote + ttl(laterVote) * 1000, generatedAtMs + 30 * day * 1000);
  assert.equal(ttl(generatedAtMs + 31 * day * 1000), 1);
  assert.equal(
    getPdfMarkdownFeedbackTtlSeconds({ entryTtlSeconds: 60, generatedAt: "not a date", now: 0 }),
    60,
  );
});
