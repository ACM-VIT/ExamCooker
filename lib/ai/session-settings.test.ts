import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAiSessionSettings } from "./session-settings";

test("saving a voice key keeps the text selection and both session keys", () => {
  const previous = {
    userId: "account-a",
    provider: "anthropic" as const,
    model: "claude-sonnet-5-5",
    keys: { anthropic: "text-key" },
    expiresAt: 1000,
  };
  const settings = buildAiSessionSettings({
    userId: "account-a",
    provider: "openai",
    model: "gpt-6-luna",
    apiKey: "voice-key",
    preserveSelection: true,
  }, previous, {}, 2000);

  assert.equal(settings.provider, "anthropic");
  assert.equal(settings.model, "claude-sonnet-5-5");
  assert.deepEqual(settings.keys, { anthropic: "text-key", openai: "voice-key" });
  assert.equal(settings.expiresAt, 2000 + 24 * 60 * 60 * 1000);
});

test("saving cannot select a provider without a key", () => {
  assert.throws(() => buildAiSessionSettings({
    userId: "account-a",
    provider: "openai",
    model: "gpt-6-luna",
  }, null, {}), /Enter an API key/);
});
