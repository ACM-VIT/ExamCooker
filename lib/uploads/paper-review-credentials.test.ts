import assert from "node:assert/strict";
import test from "node:test";
import { resolveAiTextModel } from "@/lib/ai/models";
import type { AiSessionSettings } from "@/lib/ai/session-crypto";
import { getPaperUploadReviewEnvironment, paperReviewCredentialsSchema } from "./paper-review-credentials";

const source = {
  AI_PROVIDER: "openai",
  AI_MODERATION_MODEL: "server-model",
  OPENAI_API_KEY: "shared-key",
  AI_GATEWAY_API_KEY: "shared-gateway-key",
};
const session: AiSessionSettings = {
  userId: "uploader",
  provider: "openai",
  model: "user-selected-model",
  keys: { openai: "session-key" },
  expiresAt: Date.now() + 60_000,
};

test("paper uploads without an uploader key skip automatic review", () => {
  assert.equal(getPaperUploadReviewEnvironment(source), undefined);
  assert.equal(getPaperUploadReviewEnvironment(source, undefined, { ...session, keys: {} }), undefined);
});

test("paper uploads can use the active uploader session key and server moderation model", () => {
  const environment = getPaperUploadReviewEnvironment(source, undefined, session);
  assert.ok(environment);
  assert.equal(environment.OPENAI_API_KEY, "session-key");
  assert.equal(resolveAiTextModel("moderation", environment).modelId, "server-model");
  assert.equal("AI_GATEWAY_API_KEY" in environment, false);
});

test("a supplied paper review key takes precedence over the uploader session", () => {
  const credentials = paperReviewCredentialsSchema.parse({
    provider: "anthropic",
    apiKey: "  supplied-key  ",
  });
  const environment = getPaperUploadReviewEnvironment(source, credentials, session);
  assert.ok(environment);
  assert.equal(environment.ANTHROPIC_API_KEY, "supplied-key");
  assert.equal("OPENAI_API_KEY" in environment, false);
  assert.equal(resolveAiTextModel("moderation", environment).provider, "anthropic");
});
