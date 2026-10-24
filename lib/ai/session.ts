import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/app/auth";
import { resolveAiTextModel, type AiTextProvider, type AiTextTask } from "@/lib/ai/models";
import { openAiSession, sealAiSession, type AiSessionSettings } from "@/lib/ai/session-crypto";
import { createAiSessionEnvironment, createAiSessionStatus, type AiSessionStatus } from "@/lib/ai/session-status";

export const AI_SESSION_COOKIE_NAME = "ec-ai-session";
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function encryptionSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("An auth secret is required for AI session settings.");
  return secret;
}

export async function readAiSession(userId: string) {
  const value = (await cookies()).get(AI_SESSION_COOKIE_NAME)?.value;
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
  (await cookies()).set(AI_SESSION_COOKIE_NAME, sealAiSession(settings, encryptionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return settings;
}

export async function clearAiSession() {
  (await cookies()).delete(AI_SESSION_COOKIE_NAME);
}

export async function getAiRequestEnvironment(userId?: string) {
  const id = userId ?? (await auth())?.user?.id;
  return createAiSessionEnvironment(process.env, id ? await readAiSession(id) : null, Boolean(id));
}

export async function getAiSessionStatus(userId: string, settingsOverride?: AiSessionSettings | null, task: AiTextTask = "pdfMarkdown"): Promise<AiSessionStatus> {
  const settings = settingsOverride === undefined ? await readAiSession(userId) : settingsOverride;
  return createAiSessionStatus(createAiSessionEnvironment(process.env, settings, true), settings, task);
}
