import { resolveAiTextModel, type AiTextProvider, type AiTextTask } from "./models";
import type { AiSessionSettings } from "./session-crypto";

export type AiSessionStatus = {
  provider: AiTextProvider;
  model: string;
  configuredProviders: AiTextProvider[];
  sessionProviders: AiTextProvider[];
  textReady: boolean;
  voiceReady: boolean;
};

export function createAiSessionEnvironment(
  source: Record<string, string | undefined>,
  settings: AiSessionSettings | null,
  accountRequest: boolean,
) {
  const base = {
    AI_PROVIDER: source.AI_PROVIDER,
    AI_COMMAND_MODEL: source.AI_COMMAND_MODEL,
    AI_MODERATION_MODEL: source.AI_MODERATION_MODEL,
    AI_CONTENT_CORRECTION_MODEL: source.AI_CONTENT_CORRECTION_MODEL,
    AI_PAST_PAPER_TITLE_MODEL: source.AI_PAST_PAPER_TITLE_MODEL,
    AI_PDF_MARKDOWN_MODEL: source.AI_PDF_MARKDOWN_MODEL,
    AI_VOICE_DOCUMENT_MODEL: source.AI_VOICE_DOCUMENT_MODEL,
    OPENAI_COMMAND_MODEL: source.OPENAI_COMMAND_MODEL,
    OPENAI_PDF_QA_MODEL: source.OPENAI_PDF_QA_MODEL,
    OPENAI_EMBEDDING_MODEL: source.OPENAI_EMBEDDING_MODEL,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY,
    // Account-triggered features require a direct provider key. The gateway is
    // reserved for background and other system requests without an account.
    AI_GATEWAY_API_KEY: accountRequest ? undefined : source.AI_GATEWAY_API_KEY,
  };
  if (!settings) return base;
  return {
    ...base,
    AI_PROVIDER: settings.provider,
    AI_COMMAND_MODEL: settings.model,
    AI_MODERATION_MODEL: settings.model,
    AI_CONTENT_CORRECTION_MODEL: settings.model,
    AI_PAST_PAPER_TITLE_MODEL: settings.model,
    AI_PDF_MARKDOWN_MODEL: settings.model,
    AI_VOICE_DOCUMENT_MODEL: settings.model,
    OPENAI_API_KEY: settings.keys.openai || source.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: settings.keys.anthropic || source.ANTHROPIC_API_KEY,
    AI_GATEWAY_API_KEY: undefined,
  };
}

export function createAiSessionStatus(
  environment: ReturnType<typeof createAiSessionEnvironment>,
  settings: AiSessionSettings | null,
  task: AiTextTask,
): AiSessionStatus {
  const selection = resolveAiTextModel(task, environment);
  if (selection.provider !== "openai" && selection.provider !== "anthropic") {
    throw new Error(`Unsupported AI provider: ${selection.provider}`);
  }
  const provider = selection.provider;
  const configuredProviders = (["openai", "anthropic"] as const).filter((name) =>
    Boolean(environment[name === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"]),
  );
  return {
    provider,
    model: selection.modelId,
    configuredProviders,
    sessionProviders: (["openai", "anthropic"] as const).filter((name) => Boolean(settings?.keys[name])),
    textReady: configuredProviders.includes(provider),
    voiceReady: configuredProviders.includes("openai"),
  };
}
