import assert from "node:assert/strict";
import { test } from "node:test";
import { createAiSessionEnvironment, createAiSessionStatus } from "./session-status";

test("account requests require a direct key even when the shared gateway exists", () => {
  const source = { AI_GATEWAY_API_KEY: "system-gateway" };
  const account = createAiSessionEnvironment(source, null, true);
  const system = createAiSessionEnvironment(source, null, false);

  assert.equal(account.AI_GATEWAY_API_KEY, undefined);
  assert.equal(system.AI_GATEWAY_API_KEY, "system-gateway");
  assert.equal(createAiSessionStatus(account, null, "pdfMarkdown").textReady, false);
});

test("readiness follows each task's resolved provider", () => {
  const source = {
    AI_PROVIDER: "openai",
    AI_COMMAND_MODEL: "anthropic/claude-haiku-5-5",
    OPENAI_API_KEY: "openai-key",
  };
  const environment = createAiSessionEnvironment(source, null, true);

  assert.equal(createAiSessionStatus(environment, null, "pdfMarkdown").textReady, true);
  const command = createAiSessionStatus(environment, null, "commandIntent");
  assert.equal(command.provider, "anthropic");
  assert.equal(command.textReady, false);
  assert.equal(command.voiceReady, true);
});

test("adding a voice key preserves the selected text provider and model", () => {
  const source = { AI_GATEWAY_API_KEY: "system-gateway" };
  const settings = {
    userId: "account-a",
    provider: "anthropic" as const,
    model: "claude-sonnet-5-5",
    keys: { anthropic: "text-key", openai: "voice-key" },
    expiresAt: Date.now() + 1000,
  };
  const environment = createAiSessionEnvironment(source, settings, true);
  const status = createAiSessionStatus(environment, settings, "voiceDocument");

  assert.equal(status.provider, "anthropic");
  assert.equal(status.model, "claude-sonnet-5-5");
  assert.equal(status.textReady, true);
  assert.equal(status.voiceReady, true);
  assert.equal(environment.AI_GATEWAY_API_KEY, undefined);
});
