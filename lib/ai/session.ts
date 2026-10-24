import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/app/auth";
import type { AiTextTask } from "@/lib/ai/models";
import { AI_SESSION_COOKIE_NAME } from "@/lib/ai/session-cookie";
import { openAiSession, sealAiSession, type AiSessionSettings } from "@/lib/ai/session-crypto";
import { buildAiSessionSettings, type SaveAiSessionInput } from "@/lib/ai/session-settings";
import { createAiSessionEnvironment, createAiSessionStatus, type AiSessionStatus } from "@/lib/ai/session-status";

export { AI_SESSION_COOKIE_NAME } from "@/lib/ai/session-cookie";

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

export async function saveAiSession(input: SaveAiSessionInput) {
  const previous = await readAiSession(input.userId);
  const settings = buildAiSessionSettings(input, previous, process.env);
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
