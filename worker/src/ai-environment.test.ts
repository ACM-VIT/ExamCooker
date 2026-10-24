import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCommandAiEnvironment } from "./ai-environment";
import type { Env } from "./types";

test("signed-in command requests cannot inherit worker AI credentials", () => {
  const source = {
    OPENAI_API_KEY: "shared-openai",
    AI_GATEWAY_API_KEY: "shared-gateway",
  } as Env;
  const result = buildCommandAiEnvironment(source, { AI_PROVIDER: "anthropic" }, true);

  assert.equal(result.OPENAI_API_KEY, undefined);
  assert.equal(result.AI_GATEWAY_API_KEY, undefined);
  assert.equal(result.ANTHROPIC_API_KEY, undefined);
  assert.equal(result.AI_PROVIDER, "anthropic");
});

test("signed-in command requests use their forwarded provider key", () => {
  const source = { AI_GATEWAY_API_KEY: "shared-gateway" } as Env;
  const result = buildCommandAiEnvironment(source, {
    AI_PROVIDER: "anthropic",
    ANTHROPIC_API_KEY: "account-key",
  }, true);

  assert.equal(result.ANTHROPIC_API_KEY, "account-key");
  assert.equal(result.AI_GATEWAY_API_KEY, undefined);
});
