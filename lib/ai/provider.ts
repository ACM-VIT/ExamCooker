import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import {
  getCommandEmbeddingModel,
  resolveAiTextModel,
  type AiModelSelection,
  type AiTextTask,
} from "./models";

type ProviderEnvironment = {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_GATEWAY_API_KEY?: string;
};

export function getCommandEmbeddingProvider(env: object) {
  const apiKey = (env as ProviderEnvironment).OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const modelId = getCommandEmbeddingModel(env);
  return {
    model: createOpenAI({ apiKey }).embedding(modelId),
    modelId,
  };
}

export function getAiTextModel(
  task: AiTextTask,
  env: object,
): AiModelSelection & { model: LanguageModel | string; transport: "direct" | "gateway" } {
  const variables = env as ProviderEnvironment;
  const selection = resolveAiTextModel(task, env);
  const openaiKey = variables.OPENAI_API_KEY?.trim();
  const anthropicKey = variables.ANTHROPIC_API_KEY?.trim();

  if (selection.provider === "openai" && openaiKey) {
    return {
      ...selection,
      model: createOpenAI({ apiKey: openaiKey }).responses(selection.modelId),
      transport: "direct",
    };
  }

  if (selection.provider === "anthropic" && anthropicKey) {
    return {
      ...selection,
      model: createAnthropic({ apiKey: anthropicKey })(selection.modelId),
      transport: "direct",
    };
  }

  if (variables.AI_GATEWAY_API_KEY?.trim()) {
    return { ...selection, model: selection.qualifiedModelId, transport: "gateway" };
  }

  const key = selection.provider === "anthropic" ? "ANTHROPIC_API_KEY" :
    selection.provider === "openai" ? "OPENAI_API_KEY" : "AI_GATEWAY_API_KEY";
  throw new Error(`Missing ${key} for ${selection.qualifiedModelId}.`);
}

export function getAiTextProviderOptions(selection: AiModelSelection, task?: AiTextTask) {
  if (selection.provider !== "openai") return undefined;
  return task === "commandIntent"
    ? { openai: { reasoningEffort: "low", store: false, textVerbosity: "low" } }
    : { openai: { store: false } };
}

export function getAiProviderEndpoint(selection: AiModelSelection & { transport: "direct" | "gateway" }) {
  if (selection.transport === "gateway") {
    return { baseUrl: undefined, requestUrl: undefined };
  }
  const provider = selection.provider;
  if (provider === "openai") {
    return { baseUrl: "https://api.openai.com/v1", requestUrl: "https://api.openai.com/v1/responses" };
  }
  if (provider === "anthropic") {
    return { baseUrl: "https://api.anthropic.com", requestUrl: "https://api.anthropic.com/v1/messages" };
  }
  return { baseUrl: undefined, requestUrl: undefined };
}
