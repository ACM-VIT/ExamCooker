import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { AiTextProvider } from "./models";

export type AiSessionSettings = {
  userId: string;
  provider: AiTextProvider;
  model: string;
  keys: Partial<Record<AiTextProvider, string>>;
  expiresAt: number;
};

function encryptionKey(secret: string) {
  return createHash("sha256").update(`examcooker-ai-session:${secret}`).digest();
}

export function sealAiSession(settings: AiSessionSettings, secret: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(settings), "utf8"),
    cipher.final(),
  ]);
  return [nonce, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function openAiSession(value: string, secret: string, now = Date.now()): AiSessionSettings | null {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return null;
    const [nonce, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64url"));
    if (nonce.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), nonce);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8")) as AiSessionSettings;
    if (!payload.userId || payload.expiresAt <= now) return null;
    if (payload.provider !== "openai" && payload.provider !== "anthropic") return null;
    if (typeof payload.model !== "string" || !payload.keys || typeof payload.keys !== "object") return null;
    return payload;
  } catch {
    return null;
  }
}
