import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/app/auth";
import { resolveAiTextModel, type AiTextProvider } from "@/lib/ai/models";
import { openAiSession, sealAiSession, type AiSessionSettings } from "@/lib/ai/session-crypto";

const COOKIE_NAME = "ec-ai-session";
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type AiSessionStatus = {
  provider: AiTextProvider;
  model: string;
  configuredProviders: AiTextProvider[];
  sessionProviders: AiTextProvider[];
  textReady: boolean;
  voiceReady: boolean;
};

function encryptionSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("An auth secret is required for AI session settings.");
  return secret;
}

export async function readAiSession(userId: string) {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  const settings = value ? openAiSession(value, encryptionSecret()) : null;
  return settings?.userId === userId ? settings : null;
}

export async function saveAiSession(input: {
  userId: string;
  provider: AiTextProvider;
  model: string;
  apiKey?: string;
  preserveSelection?: boolean;
}) {
  const previous = await readAiSession(input.userId);
  const keys = { ...previous?.keys };
  if (input.apiKey) keys[input.provider] = input.apiKey;
  const environmentKey = input.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  if (!keys[input.provider] && !process.env[environmentKey]) throw new Error("Enter an API key for the selected provider.");
  const defaultSelection = resolveAiTextModel("pdfMarkdown", process.env);
  const settings: AiSessionSettings = {
    userId: input.userId,
    provider: input.preserveSelection
      ? previous?.provider ?? (defaultSelection.provider === "anthropic" ? "anthropic" : "openai")
      : input.provider,
    model: input.preserveSelection
      ? previous?.model ?? defaultSelection.modelId
      : input.model,
    keys,
    expiresAt: Date.now() + SESSION_LIFETIME_MS,
  };
  (await cookies()).set(COOKIE_NAME, sealAiSession(settings, encryptionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return settings;
}

export async function clearAiSession() {
  (await cookies()).delete(COOKIE_NAME);
}

function environmentForSettings(settings: AiSessionSettings | null) {
  const base = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_COMMAND_MODEL: process.env.AI_COMMAND_MODEL,
    AI_MODERATION_MODEL: process.env.AI_MODERATION_MODEL,
    AI_CONTENT_CORRECTION_MODEL: process.env.AI_CONTENT_CORRECTION_MODEL,
    AI_PAST_PAPER_TITLE_MODEL: process.env.AI_PAST_PAPER_TITLE_MODEL,
    AI_PDF_MARKDOWN_MODEL: process.env.AI_PDF_MARKDOWN_MODEL,
    AI_VOICE_DOCUMENT_MODEL: process.env.AI_VOICE_DOCUMENT_MODEL,
    OPENAI_COMMAND_MODEL: process.env.OPENAI_COMMAND_MODEL,
    OPENAI_PDF_QA_MODEL: process.env.OPENAI_PDF_QA_MODEL,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
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
    OPENAI_API_KEY: settings.keys.openai || process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: settings.keys.anthropic || process.env.ANTHROPIC_API_KEY,
    AI_GATEWAY_API_KEY: undefined,
  };
}

export async function getAiRequestEnvironment(userId?: string) {
  const id = userId ?? (await auth())?.user?.id;
  return environmentForSettings(id ? await readAiSession(id) : null);
}

export async function getAiSessionStatus(userId: string, settingsOverride?: AiSessionSettings | null): Promise<AiSessionStatus> {
  const settings = settingsOverride === undefined ? await readAiSession(userId) : settingsOverride;
  const environment = environmentForSettings(settings);
  const provider = environment.AI_PROVIDER === "anthropic" ? "anthropic" : "openai";
  const model = resolveAiTextModel("pdfMarkdown", environment).modelId;
  const configuredProviders = (["openai", "anthropic"] as const).filter((name) =>
    Boolean(environment[name === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"]),
  );
  return {
    provider,
    model,
    configuredProviders,
    sessionProviders: (["openai", "anthropic"] as const).filter((name) => Boolean(settings?.keys[name])),
    textReady: configuredProviders.includes(provider),
    voiceReady: configuredProviders.includes("openai"),
  };
}
