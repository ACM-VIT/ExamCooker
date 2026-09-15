import "server-only";
import OpenAI from "openai";

export function createVoiceOpenAIClient() {
  // Session creation is billable; never retry it automatically.
  return new OpenAI({ maxRetries: 0, timeout: 30_000 });
}
