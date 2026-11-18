import { resolveAiTextModel, type AiTextProvider } from "@/lib/ai/models";
import type { AiSessionSettings } from "@/lib/ai/session-crypto";
import { createModerationKeyEnvironment } from "@/lib/ai/session-status";

const providerKeyNames = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
} as const;

function serverModerationProvider(source: Record<string, string | undefined>) {
  try {
    const { provider } = resolveAiTextModel("moderation", source);
    return provider === "openai" || provider === "anthropic" ? provider : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Chooses who pays for an upload's automatic review: the server's direct key
 * for its moderation provider, else the uploader's session key for their
 * selected provider, else no review (the upload waits for a moderator).
 * Uploads are account-triggered, so the shared gateway key is never used, and
 * the moderation model stays the server's choice for the chosen provider.
 */
export function getUploadReviewEnvironment(
  source: Record<string, string | undefined>,
  session?: AiSessionSettings | null,
) {
  const serverProvider = serverModerationProvider(source);
  const serverKey = serverProvider && source[providerKeyNames[serverProvider]]?.trim();
  if (serverProvider && serverKey) {
    return createModerationKeyEnvironment(source, serverProvider, serverKey);
  }

  const sessionProvider: AiTextProvider | undefined = session?.provider;
  const sessionKey = sessionProvider && session?.keys[sessionProvider]?.trim();
  if (sessionProvider && sessionKey) {
    return createModerationKeyEnvironment(source, sessionProvider, sessionKey);
  }

  return undefined;
}
