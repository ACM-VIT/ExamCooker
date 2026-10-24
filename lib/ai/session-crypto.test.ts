import assert from "node:assert/strict";
import { test } from "node:test";
import { openAiSession, sealAiSession } from "./session-crypto";

test("AI session credentials are encrypted and expire", () => {
  const settings = {
    userId: "account-a",
    provider: "anthropic" as const,
    model: "claude-sonnet-5-5",
    keys: { anthropic: "private-test-key" },
    expiresAt: 10_000,
  };
  const token = sealAiSession(settings, "auth-secret");

  assert.equal(token.includes(settings.keys.anthropic), false);
  assert.deepEqual(openAiSession(token, "auth-secret", 9_999), settings);
  assert.equal(openAiSession(token, "auth-secret", 10_000), null);
  assert.equal(openAiSession(token, "different-secret", 9_999), null);
  const parts = token.split(".");
  parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  assert.equal(openAiSession(parts.join("."), "auth-secret", 9_999), null);
});
