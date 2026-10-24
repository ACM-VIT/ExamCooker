import type { CommandIntentRequestInput, Env } from "./types";

export function buildCommandAiEnvironment(
  source: Env,
  requestedAi: CommandIntentRequestInput["aiEnvironment"],
  authenticated: boolean,
): Env {
  return {
    ...source,
    ...(authenticated ? {
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      AI_GATEWAY_API_KEY: undefined,
    } : {}),
    ...(requestedAi?.AI_PROVIDER === "openai" || requestedAi?.AI_PROVIDER === "anthropic"
      ? { AI_PROVIDER: requestedAi.AI_PROVIDER }
      : {}),
    ...(typeof requestedAi?.AI_COMMAND_MODEL === "string" && requestedAi.AI_COMMAND_MODEL.length <= 100
      ? { AI_COMMAND_MODEL: requestedAi.AI_COMMAND_MODEL }
      : {}),
    ...(typeof requestedAi?.OPENAI_API_KEY === "string" && requestedAi.OPENAI_API_KEY.length <= 512
      ? { OPENAI_API_KEY: requestedAi.OPENAI_API_KEY }
      : {}),
    ...(typeof requestedAi?.ANTHROPIC_API_KEY === "string" && requestedAi.ANTHROPIC_API_KEY.length <= 512
      ? { ANTHROPIC_API_KEY: requestedAi.ANTHROPIC_API_KEY }
      : {}),
  };
}
