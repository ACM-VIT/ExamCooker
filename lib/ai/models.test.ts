import assert from "node:assert/strict";
import { test } from "node:test";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getCommandEmbeddingModel, resolveAiTextModel } from "./models";
import {
  getAiProviderEndpoint,
  getAiTextModel,
  getAiTextProviderOptions,
  getCommandEmbeddingProvider,
} from "./provider";

test("task defaults select the matching provider and model", () => {
  assert.deepEqual(resolveAiTextModel("commandIntent", {}), {
    provider: "openai",
    modelId: "gpt-6-luna",
    qualifiedModelId: "openai/gpt-6-luna",
  });
  assert.deepEqual(resolveAiTextModel("commandIntent", { AI_PROVIDER: "anthropic" }), {
    provider: "anthropic",
    modelId: "claude-haiku-5-5",
    qualifiedModelId: "anthropic/claude-haiku-5-5",
  });
  assert.equal(
    resolveAiTextModel("pdfMarkdown", { AI_PROVIDER: "anthropic" }).qualifiedModelId,
    "anthropic/claude-sonnet-5-5",
  );
  assert.equal(getCommandEmbeddingModel({}), "text-embedding-3-small");
  assert.equal(getCommandEmbeddingProvider({ AI_PROVIDER: "anthropic" }), null);
  assert.equal(getCommandEmbeddingProvider({
    OPENAI_API_KEY: "openai-test",
    OPENAI_EMBEDDING_MODEL: "text-embedding-3-large",
  })?.modelId, "text-embedding-3-large");
  assert.equal(
    resolveAiTextModel("voiceDocument", { AI_PROVIDER: "anthropic" }).qualifiedModelId,
    "anthropic/claude-sonnet-5-5",
  );
});

test("qualified overrides and legacy command settings resolve without changing providers", () => {
  assert.equal(
    resolveAiTextModel("moderation", {
      AI_MODERATION_MODEL: "anthropic/claude-opus-5-5",
    }).qualifiedModelId,
    "anthropic/claude-opus-5-5",
  );
  assert.equal(
    resolveAiTextModel("commandIntent", {
      OPENAI_COMMAND_MODEL: "gpt-6-sol",
    }).modelId,
    "gpt-6-sol",
  );
  assert.equal(
    resolveAiTextModel("commandIntent", {
      AI_PROVIDER: "anthropic",
      OPENAI_COMMAND_MODEL: "gpt-6-sol",
    }).qualifiedModelId,
    "anthropic/claude-haiku-5-5",
  );
  assert.equal(
    resolveAiTextModel("voiceDocument", { OPENAI_PDF_QA_MODEL: "gpt-6-sol" }).modelId,
    "gpt-6-sol",
  );
});

test("Anthropic accepts the voice study image and catalog PDF inputs", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://example.test/paper.pdf") {
      return new Response(Buffer.from("%PDF-1.4\n"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      id: "msg_voice_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "The page contains a question." }],
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 8 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const selection = getAiTextModel("voiceDocument", {
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "anthropic-test",
    });
    const image = await generateText({
      model: selection.model,
      messages: [{ role: "user", content: [
        { type: "text", text: "Read the visible page." },
        { type: "file", mediaType: "image/png", data: "data:image/png;base64,iVBORw0KGgo=" },
      ] }],
      maxRetries: 0,
    });
    const document = await generateText({
      model: selection.model,
      messages: [{ role: "user", content: [
        { type: "text", text: "Read the PDF." },
        { type: "file", mediaType: "application/pdf", data: new URL("https://example.test/paper.pdf") },
      ] }],
      maxRetries: 0,
    });

    assert.equal(image.finishReason, "stop");
    assert.equal(document.finishReason, "stop");
    const imageContent = (requests[0].messages as Array<{ content: Array<{ type: string }> }>)[0].content;
    const documentContent = (requests[1].messages as Array<{ content: Array<{ type: string }> }>)[0].content;
    assert.equal(imageContent.some((part) => part.type === "image"), true);
    assert.equal(documentContent.some((part) => part.type === "document"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI voice study inputs keep high-detail images and PDF references", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://example.test/paper.pdf") {
      return new Response(Buffer.from("%PDF-1.4\n"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      id: "resp_voice_test",
      object: "response",
      created_at: 1,
      status: "completed",
      model: "gpt-6-luna",
      output: [{
        type: "message",
        id: "msg_voice_test",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text: "The page contains a question.", annotations: [] }],
      }],
      usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
      error: null,
      incomplete_details: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const selection = getAiTextModel("voiceDocument", { OPENAI_API_KEY: "openai-test" });
    const image = await generateText({
      model: selection.model,
      messages: [{ role: "user", content: [
        { type: "text", text: "Read the page." },
        {
          type: "file",
          mediaType: "image/png",
          data: "data:image/png;base64,iVBORw0KGgo=",
          providerOptions: { openai: { imageDetail: "high" } },
        },
      ] }],
      maxRetries: 0,
    });
    const document = await generateText({
      model: selection.model,
      messages: [{ role: "user", content: [
        { type: "text", text: "Read the PDF." },
        { type: "file", mediaType: "application/pdf", data: new URL("https://example.test/paper.pdf") },
      ] }],
      maxRetries: 0,
    });

    assert.equal(image.finishReason, "stop");
    assert.equal(document.finishReason, "stop");
    assert.equal(requests.length, 2);
    const imageContent = (requests[0].input as Array<{ content: Array<{ type: string; detail?: string }> }>)[0].content;
    const documentContent = (requests[1].input as Array<{ content: Array<{ type: string }> }>)[0].content;
    assert.equal(imageContent.some((part) => part.type === "input_image" && part.detail === "high"), true);
    assert.equal(documentContent.some((part) => part.type === "input_file"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("selected providers require their own credentials or an explicit gateway", () => {
  const openai = getAiTextModel("moderation", { OPENAI_API_KEY: "openai-test" });
  assert.equal(openai.provider, "openai");
  assert.notEqual(typeof openai.model, "string");
  assert.deepEqual(getAiTextProviderOptions(openai, "commandIntent"), {
    openai: { reasoningEffort: "low", store: false, textVerbosity: "low" },
  });
  assert.throws(
    () => getAiTextModel("moderation", { AI_PROVIDER: "anthropic", OPENAI_API_KEY: "openai-test" }),
    /Missing ANTHROPIC_API_KEY/,
  );
  const gateway = getAiTextModel("moderation", {
      AI_PROVIDER: "anthropic",
      AI_GATEWAY_API_KEY: "gateway-test",
    });
  assert.equal(gateway.model, "anthropic/claude-sonnet-5-5");
  assert.equal(gateway.transport, "gateway");
  assert.equal(getAiProviderEndpoint(gateway).requestUrl, undefined);
  assert.equal(getAiTextProviderOptions({
    provider: "anthropic",
    modelId: "claude-sonnet-5-5",
    qualifiedModelId: "anthropic/claude-sonnet-5-5",
  }), undefined);
  assert.throws(() => resolveAiTextModel("moderation", { AI_PROVIDER: "unknown" }), /Unsupported AI_PROVIDER/);
});

test("Anthropic receives PDF content through the shared AI SDK model", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: '{"summary":"A question appears on the page."}' }],
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 8 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const selection = getAiTextModel("moderation", {
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "anthropic-test",
    });
    const result = await generateText({
      model: selection.model,
      output: Output.object({ schema: z.object({ summary: z.string() }) }),
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Read this PDF." },
          { type: "file", mediaType: "application/pdf", data: Buffer.from("%PDF-1.4\n") },
        ],
      }],
      maxRetries: 0,
    });

    assert.deepEqual(result.output, { summary: "A question appears on the page." });
    assert.equal(requestUrl, "https://api.anthropic.com/v1/messages");
    assert.equal(requestBody?.model, "claude-sonnet-5-5");
    const messages = requestBody?.messages as Array<{ content: Array<{ type: string }> }>;
    assert.equal(messages[0].content.some((part) => part.type === "document"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
