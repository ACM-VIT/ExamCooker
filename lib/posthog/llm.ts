import { createPostHogServer } from "@/lib/posthog-server";

type PostHogAiRole = "system" | "user" | "assistant";

type PostHogAiContentPart = {
  type: string;
  [key: string]: unknown;
};

export type PostHogAiMessage = {
  role: PostHogAiRole;
  content: PostHogAiContentPart[];
};

type PostHogAiGenerationInput = {
  distinctId: string;
  traceId: string;
  sessionId?: string;
  spanId?: string;
  spanName?: string;
  parentId?: string;
  model: string;
  provider: string;
  input: PostHogAiMessage[];
  inputTokens?: number;
  outputChoices?: PostHogAiMessage[];
  outputTokens?: number;
  latencySeconds?: number;
  timeToFirstTokenSeconds?: number;
  httpStatus?: number;
  baseUrl?: string;
  requestUrl?: string;
  isError?: boolean;
  error?: unknown;
  stopReason?: string;
  stream?: boolean;
  maxTokens?: number | "inf";
  temperature?: number;
  extraProperties?: Record<string, unknown>;
};

function cleanProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
}

function normalizeAiError(error: unknown) {
  if (typeof error === "string") {
    return error.slice(0, 500);
  }

  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error).slice(0, 500);
    } catch {
      return "Unknown AI error.";
    }
  }

  return undefined;
}

export function createAiTextMessage(
  role: PostHogAiRole,
  ...texts: Array<string | null | undefined>
): PostHogAiMessage {
  const content = texts
    .map((text) => text?.trim())
    .filter((text): text is string => Boolean(text))
    .map((text) => ({
      type: "text",
      text,
    }));

  return {
    role,
    content,
  };
}

export async function capturePostHogAiGeneration(
  input: PostHogAiGenerationInput,
) {
  const posthog = createPostHogServer();
  if (!posthog) {
    return;
  }

  try {
    posthog.capture({
      distinctId: input.distinctId,
      event: "$ai_generation",
      properties: cleanProperties({
        $ai_trace_id: input.traceId,
        $ai_session_id: input.sessionId,
        $ai_span_id: input.spanId,
        $ai_span_name: input.spanName,
        $ai_parent_id: input.parentId,
        $ai_model: input.model,
        $ai_provider: input.provider,
        $ai_input: input.input,
        $ai_input_tokens: input.inputTokens,
        $ai_output_choices:
          input.outputChoices && input.outputChoices.length > 0
            ? input.outputChoices
            : undefined,
        $ai_output_tokens: input.outputTokens,
        $ai_latency: input.latencySeconds,
        $ai_time_to_first_token: input.timeToFirstTokenSeconds,
        $ai_http_status: input.httpStatus,
        $ai_base_url: input.baseUrl,
        $ai_request_url: input.requestUrl,
        $ai_is_error: input.isError,
        $ai_error: normalizeAiError(input.error),
        $ai_stop_reason: input.stopReason,
        $ai_stream: input.stream,
        $ai_max_tokens: input.maxTokens,
        $ai_temperature: input.temperature,
        ...input.extraProperties,
      }),
    });
  } catch (error) {
    console.error("[posthog] ai generation capture failed", error);
  } finally {
    try {
      await posthog.shutdown();
    } catch (error) {
      console.error("[posthog] ai generation flush failed", error);
    }
  }
}
