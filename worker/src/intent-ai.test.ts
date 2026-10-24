import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCommandIntentWithAI } from "./intent-ai";
import type { Env } from "./types";

test("Anthropic command intent calls the command surface before returning an intent", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const toolStep = requests.length === 1;
    return new Response(JSON.stringify({
      id: `msg_test_${requests.length}`,
      type: "message",
      role: "assistant",
      content: toolStep
        ? [{ type: "tool_use", id: "toolu_surface", name: "getCommandSurface", input: {} }]
        : [{
            type: "text",
            text: JSON.stringify({
              resource: "notes",
              examType: null,
              confidence: "high",
              courseQuery: "control systems",
              actions: [],
            }),
          }],
      model: "claude-haiku-5-5",
      stop_reason: toolStep ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 15 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await resolveCommandIntentWithAI({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "anthropic-test",
    } as Env, "notes for control systems");

    assert.equal(result.resolver, "anthropic");
    assert.equal(result.intent.resource, "notes");
    assert.equal(result.courseQuery, "control systems");
    assert.equal(requests.length, 2);
    assert.equal(requests[0].model, "claude-haiku-5-5");
    assert.deepEqual(requests[0].tool_choice, { type: "tool", name: "getCommandSurface" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
