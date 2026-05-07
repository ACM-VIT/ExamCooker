"use server";

import { after } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import {
  capturePostHogAiGeneration,
  createAiTextMessage,
} from "@/lib/posthog/llm";

const DEFAULT_VISIBLE_PDF_QA_MODEL =
  process.env.OPENAI_PDF_QA_MODEL?.trim() || "gpt-5.4-mini";
const VISIBLE_PDF_ANSWER_SYSTEM_PROMPT =
  "You answer questions about the currently visible ExamCooker PDF page from an image. " +
  "Read the page image directly, including diagrams, tables, and visual layout. " +
  "If the user asks for a question number, solve or explain that visible question. " +
  "If part of the page is genuinely unreadable, state that specific limitation and answer any visible parts. " +
  "Keep answers concise for spoken delivery unless the user explicitly asks for step-by-step detail.";

const VisiblePdfQuestionRequestSchema = z.object({
  currentPage: z.number().int().min(1).max(10000).optional(),
  fileName: z.string().trim().min(1).max(240),
  imageDataUrl: z
    .string()
    .trim()
    .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i)
    .max(8_500_000),
  imageHeight: z.number().int().positive().max(10000).optional(),
  imageSource: z.enum(["pdf-page-image", "canvas"]).optional(),
  imageWidth: z.number().int().positive().max(10000).optional(),
  posthogSessionId: z.string().trim().min(1).max(200).nullable().optional(),
  question: z.string().trim().min(1).max(1200),
  title: z.string().trim().max(240).optional(),
  totalPages: z.number().int().min(1).max(10000).optional(),
  voiceEntryPoint: z.enum(["nav", "home_search"]).optional(),
  voiceSessionId: z.string().trim().min(1).max(200).optional(),
});

const VoiceRealtimeAnalyticsSchema = z.object({
  browserPath: z.string().trim().min(1).max(2000),
  conversationId: z.string().trim().min(1).max(200).nullable().optional(),
  entryPoint: z.enum(["nav", "home_search"]),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional(),
  inputText: z.string().trim().min(1).max(4000),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  latencySeconds: z.number().nonnegative().max(3600),
  model: z.string().trim().min(1).max(200),
  outputText: z.string().trim().min(1).max(8000).nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  posthogSessionId: z.string().trim().min(1).max(200).nullable().optional(),
  responseId: z.string().trim().min(1).max(200).nullable().optional(),
  status: z.string().trim().min(1).max(50),
  stopReason: z.string().trim().min(1).max(200).nullable().optional(),
  timeToFirstTokenSeconds: z.number().nonnegative().max(3600).nullable().optional(),
  voiceSessionId: z.string().trim().min(1).max(200),
});

type VisiblePdfQuestionRequest = z.infer<typeof VisiblePdfQuestionRequestSchema>;
type VoiceRealtimeAnalytics = z.infer<typeof VoiceRealtimeAnalyticsSchema>;

type ResponsesApiPayload = {
  error?: {
    message?: string;
  } | null;
  incomplete_details?: {
    reason?: string;
  } | null;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  output_text?: string;
  status?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  } | null;
};

export type VoicePdfAnswerActionResult =
  | {
      ok: true;
      answer: string;
      currentPage: number | null;
      fileName: string;
      totalPages: number | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export type VoiceRealtimeAnalyticsActionResult = {
  ok: boolean;
};

function buildVisiblePdfQuestionPrompt(input: VisiblePdfQuestionRequest) {
  const contextParts = [
    `Document title: ${input.fileName}.`,
    input.title ? `Current page title on ExamCooker: ${input.title}.` : null,
    input.currentPage && input.totalPages
      ? `The image is page ${input.currentPage} of ${input.totalPages}.`
      : input.currentPage
        ? `The image is page ${input.currentPage}.`
        : null,
    input.imageWidth && input.imageHeight
      ? `Image dimensions: ${input.imageWidth}x${input.imageHeight}.`
      : null,
  ].filter(Boolean);

  return [...contextParts, `User question: ${input.question}`].join(" ");
}

function extractOutputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter(
      (content) =>
        content.type === "output_text" && typeof content.text === "string",
    )
    .map((content) => content.text?.trim())
    .filter(Boolean)
    .join("\n\n");

  return text || null;
}

function scheduleVisiblePdfAnswerCapture(input: {
  answer?: string | null;
  body: VisiblePdfQuestionRequest;
  distinctId: string | null;
  errorMessage?: string;
  httpStatus?: number;
  inputPrompt: string;
  latencySeconds: number;
  payload: ResponsesApiPayload | null;
}) {
  if (!input.distinctId) {
    return;
  }

  after(async () => {
    await capturePostHogAiGeneration({
      distinctId: input.distinctId!,
      traceId: input.body.voiceSessionId ?? crypto.randomUUID(),
      sessionId: input.body.posthogSessionId ?? undefined,
      spanId: crypto.randomUUID(),
      spanName: "voice_visible_pdf_answer",
      model: DEFAULT_VISIBLE_PDF_QA_MODEL,
      provider: "openai",
      input: [
        createAiTextMessage("system", VISIBLE_PDF_ANSWER_SYSTEM_PROMPT),
        createAiTextMessage("user", input.inputPrompt),
      ],
      inputTokens: input.payload?.usage?.input_tokens,
      outputChoices: input.answer
        ? [createAiTextMessage("assistant", input.answer)]
        : undefined,
      outputTokens: input.payload?.usage?.output_tokens,
      latencySeconds: input.latencySeconds,
      httpStatus: input.httpStatus,
      baseUrl: "https://api.openai.com/v1",
      requestUrl: "https://api.openai.com/v1/responses",
      isError: Boolean(input.errorMessage),
      error: input.errorMessage,
      stopReason:
        input.payload?.incomplete_details?.reason ??
        input.payload?.status ??
        undefined,
      stream: false,
      extraProperties: {
        ai_surface: "voice_agent",
        voice_current_page: input.body.currentPage,
        voice_entry_point: input.body.voiceEntryPoint,
        voice_file_name: input.body.fileName,
        voice_image_height: input.body.imageHeight,
        voice_image_source: input.body.imageSource,
        voice_image_width: input.body.imageWidth,
        voice_pdf_title: input.body.title,
        voice_route_path: "server_action:answerVisiblePdfPageQuestion",
        voice_total_pages: input.body.totalPages,
      },
    });
  });
}

export async function answerVisiblePdfPageQuestionAction(
  input: unknown,
): Promise<VoicePdfAnswerActionResult> {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      ok: false,
      error: "You must be signed in to use voice document answers.",
      status: 401,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Missing OPENAI_API_KEY.",
      status: 500,
    };
  }

  const parsedBody = VisiblePdfQuestionRequestSchema.safeParse(input);
  if (!parsedBody.success) {
    return {
      ok: false,
      error: parsedBody.error.message,
      status: 400,
    };
  }

  const body = parsedBody.data;
  const inputPrompt = buildVisiblePdfQuestionPrompt(body);
  const llmStartedAt = Date.now();

  const upstreamResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_VISIBLE_PDF_QA_MODEL,
      max_output_tokens: 450,
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: VISIBLE_PDF_ANSWER_SYSTEM_PROMPT,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: inputPrompt,
            },
            {
              type: "input_image",
              image_url: body.imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  const responseText = await upstreamResponse.text();
  const latencySeconds = Math.max(Date.now() - llmStartedAt, 0) / 1000;
  let payload: ResponsesApiPayload | null = null;

  try {
    payload = JSON.parse(responseText) as ResponsesApiPayload;
  } catch {
    payload = null;
  }

  if (!upstreamResponse.ok) {
    const message =
      payload?.error?.message ||
      responseText ||
      "Failed to answer the visible PDF question.";

    scheduleVisiblePdfAnswerCapture({
      body,
      distinctId: session.user.id ?? session.user.email ?? null,
      errorMessage: message,
      httpStatus: upstreamResponse.status,
      inputPrompt,
      latencySeconds,
      payload,
    });

    return {
      ok: false,
      error: message,
      status: upstreamResponse.status,
    };
  }

  const answer = payload ? extractOutputText(payload) : null;
  if (!answer) {
    const message = payload?.incomplete_details?.reason
      ? `The visible PDF answer was incomplete: ${payload.incomplete_details.reason}.`
      : "OpenAI did not return a usable visible PDF answer.";

    scheduleVisiblePdfAnswerCapture({
      body,
      distinctId: session.user.id ?? session.user.email ?? null,
      errorMessage: message,
      httpStatus: upstreamResponse.status,
      inputPrompt,
      latencySeconds,
      payload,
    });

    return {
      ok: false,
      error: message,
      status: 502,
    };
  }

  scheduleVisiblePdfAnswerCapture({
    answer,
    body,
    distinctId: session.user.id ?? session.user.email ?? null,
    httpStatus: upstreamResponse.status,
    inputPrompt,
    latencySeconds,
    payload,
  });

  return {
    ok: true,
    answer,
    currentPage: body.currentPage ?? null,
    fileName: body.fileName,
    totalPages: body.totalPages ?? null,
  };
}

export async function captureVoiceRealtimeAnalyticsAction(
  input: unknown,
): Promise<VoiceRealtimeAnalyticsActionResult> {
  const session = await auth();
  const distinctId = session?.user?.id ?? session?.user?.email ?? null;
  if (!distinctId) {
    return { ok: false };
  }

  const parsedBody = VoiceRealtimeAnalyticsSchema.safeParse(input);
  if (!parsedBody.success) {
    return { ok: false };
  }

  const body: VoiceRealtimeAnalytics = parsedBody.data;

  after(async () => {
    await capturePostHogAiGeneration({
      distinctId,
      traceId: body.voiceSessionId,
      sessionId: body.posthogSessionId ?? undefined,
      spanId: body.responseId ?? crypto.randomUUID(),
      spanName: "voice_turn",
      model: body.model,
      provider: "openai",
      input: [createAiTextMessage("user", body.inputText)],
      inputTokens: body.inputTokens ?? undefined,
      outputChoices: body.outputText
        ? [createAiTextMessage("assistant", body.outputText)]
        : undefined,
      outputTokens: body.outputTokens ?? undefined,
      latencySeconds: body.latencySeconds,
      timeToFirstTokenSeconds:
        body.timeToFirstTokenSeconds ?? undefined,
      baseUrl: "https://api.openai.com/v1",
      requestUrl: "https://api.openai.com/v1/realtime/calls",
      isError: body.status !== "completed" || Boolean(body.errorMessage),
      error: body.errorMessage ?? undefined,
      stopReason:
        body.stopReason ??
        (body.status !== "completed" ? body.status : undefined),
      stream: true,
      extraProperties: {
        ai_surface: "voice_agent",
        voice_conversation_id: body.conversationId ?? undefined,
        voice_entry_point: body.entryPoint,
        voice_response_id: body.responseId ?? undefined,
        voice_response_status: body.status,
        voice_route_path: body.browserPath,
      },
    });
  });

  return { ok: true };
}
