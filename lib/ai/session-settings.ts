import { resolveAiTextModel, type AiTextProvider } from "./models";
import type { AiSessionSettings } from "./session-crypto";

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type SaveAiSessionInput = {
  userId: string;
  provider: AiTextProvider;
  model: string;
  apiKey?: string;
  preserveSelection?: boolean;
};

export function buildAiSessionSettings(
  input: SaveAiSessionInput,
  previous: AiSessionSettings | null,
  environment: Record<string, string | undefined>,
  now = Date.now(),
): AiSessionSettings {
  const keys = { ...previous?.keys };
  if (input.apiKey) keys[input.provider] = input.apiKey;
  const environmentKey = input.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  if (!keys[input.provider] && !environment[environmentKey]) {
    throw new Error("Enter an API key for the selected provider.");
  }

  const defaultSelection = resolveAiTextModel("pdfMarkdown", environment);
  return {
    userId: input.userId,
    provider: input.preserveSelection
      ? previous?.provider ?? (defaultSelection.provider === "anthropic" ? "anthropic" : "openai")
      : input.provider,
    model: input.preserveSelection
      ? previous?.model ?? defaultSelection.modelId
      : input.model,
    keys,
    expiresAt: now + SESSION_LIFETIME_MS,
  };
}
