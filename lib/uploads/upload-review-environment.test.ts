import assert from "node:assert/strict";
import test from "node:test";
import { resolveAiTextModel } from "@/lib/ai/models";
import type { AiSessionSettings } from "@/lib/ai/session-crypto";
import { getUploadReviewEnvironment } from "./upload-review-environment";

const session: AiSessionSettings = {
  userId: "uploader",
  provider: "anthropic",
  model: "user-selected-model",
  keys: { anthropic: "session-key" },
  expiresAt: Date.now() + 60_000,
};

test("the server's key for its moderation provider is used first", () => {
  const environment = getUploadReviewEnvironment(
    {
      AI_PROVIDER: "openai",
      AI_MODERATION_MODEL: "server-model",
      OPENAI_API_KEY: " server-key ",
      AI_GATEWAY_API_KEY: "shared-gateway-key",
    },
    session,
  );
  assert.ok(environment);
  assert.equal(environment.OPENAI_API_KEY, "server-key");
  assert.equal("ANTHROPIC_API_KEY" in environment, false);
  assert.equal("AI_GATEWAY_API_KEY" in environment, false);
  assert.equal(resolveAiTextModel("moderation", environment).qualifiedModelId, "openai/server-model");
});

test("a qualified moderation model selects which server key counts", () => {
  const source = {
    AI_PROVIDER: "openai",
    AI_MODERATION_MODEL: "anthropic/claude-opus-5-5",
    OPENAI_API_KEY: "openai-server-key",
  };
  assert.equal(getUploadReviewEnvironment(source), undefined);

  const environment = getUploadReviewEnvironment({ ...source, ANTHROPIC_API_KEY: "anthropic-server-key" });
  assert.ok(environment);
  assert.equal(environment.ANTHROPIC_API_KEY, "anthropic-server-key");
  assert.equal(resolveAiTextModel("moderation", environment).qualifiedModelId, "anthropic/claude-opus-5-5");
});

test("without a server key the uploader's session key pays and the server picks the model", () => {
  const environment = getUploadReviewEnvironment(
    {
      AI_PROVIDER: "openai",
      AI_MODERATION_MODEL: "anthropic/server-model",
      AI_GATEWAY_API_KEY: "shared-gateway-key",
    },
    session,
  );
  assert.ok(environment);
  assert.equal(environment.ANTHROPIC_API_KEY, "session-key");
  assert.equal("AI_GATEWAY_API_KEY" in environment, false);
  assert.equal(resolveAiTextModel("moderation", environment).qualifiedModelId, "anthropic/server-model");
});

test("a session key for another provider than the session's selection is not used", () => {
  const environment = getUploadReviewEnvironment(
    {},
    { ...session, provider: "openai", keys: { anthropic: "session-key" } },
  );
  assert.equal(environment, undefined);
});

test("review is skipped without a server or session key, even with the shared gateway", () => {
  const source = { AI_PROVIDER: "openai", AI_GATEWAY_API_KEY: "shared-gateway-key" };
  assert.equal(getUploadReviewEnvironment(source), undefined);
  assert.equal(getUploadReviewEnvironment(source, null), undefined);
  assert.equal(getUploadReviewEnvironment(source, { ...session, keys: { anthropic: "  " } }), undefined);
});

test("an unsupported server provider falls back to the session key", () => {
  const environment = getUploadReviewEnvironment({ AI_PROVIDER: "other", OPENAI_API_KEY: "key" }, session);
  assert.ok(environment);
  assert.equal(environment.ANTHROPIC_API_KEY, "session-key");
});
