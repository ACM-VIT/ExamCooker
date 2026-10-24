import "server-only";
import OpenAI from "openai";

export function createVoiceOpenAIClient(apiKey: string) {
  // Session creation is billable; never retry it automatically.
  return new OpenAI({ apiKey, maxRetries: 0, timeout: 30_000 });
}
