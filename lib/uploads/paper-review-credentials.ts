import { z } from "zod";
import type { AiSessionSettings } from "@/lib/ai/session-crypto";
import { createModerationKeyEnvironment } from "@/lib/ai/session-status";

export const paperReviewCredentialsSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  apiKey: z.string().trim().min(1).max(512),
});

export function getPaperUploadReviewEnvironment(
  source: Record<string, string | undefined>,
  credentials?: z.infer<typeof paperReviewCredentialsSchema>,
  session?: AiSessionSettings | null,
) {
  const provider = credentials?.provider ?? session?.provider;
  const apiKey = credentials?.apiKey ?? (provider && session?.keys[provider]?.trim());
  return provider && apiKey ? createModerationKeyEnvironment(source, provider, apiKey) : undefined;
}
