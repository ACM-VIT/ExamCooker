import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/app/auth";
import {
  capturePostHogAiGeneration,
  createAiTextMessage,
} from "@/lib/posthog/llm";

const DEFAULT_PDF_QA_MODEL =
  process.env.OPENAI_PDF_QA_MODEL?.trim() || "gpt-5.4-mini";
const MAX_INLINE_PDF_BYTES = 18 * 1024 * 1024;
const PDF_ANSWER_SYSTEM_PROMPT =
  "You answer questions about an ExamCooker PDF. Ground every answer in the document. " +
  "Mention page numbers when they are helpful or when the user asks about a specific page. " +
  "If the user says this question, that question, or this page, focus on the current page context. " +
  "If the answer is not in the PDF, say so briefly instead of guessing. " +
  "Keep answers concise for spoken delivery: 1-3 short sentences unless the user explicitly asks for detail.";

const PdfQuestionRequestSchema = z.object({
  currentPage: z.number().int().min(1).max(10000).optional(),
  fileName: z.string().trim().min(1).max(240),
  fileUrl: z.string().trim().url(),
  posthogSessionId: z.string().trim().min(1).max(200).nullable().optional(),
  question: z.string().trim().min(1).max(1200),
  title: z.string().trim().max(240).optional(),
  totalPages: z.number().int().min(1).max(10000).optional(),
  voiceEntryPoint: z.enum(["nav", "home_search"]).optional(),
  voiceSessionId: z.string().trim().min(1).max(200).optional(),
});

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

type PdfFileInput = {
  file_data?: string;
  file_url?: string;
  filename?: string;
  type: "input_file";
};

type AllowedPdfSource = {
  origin: string;
  pathPrefix: string;
};

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseAllowedPdfSource(
  rawValue: string,
  requestUrl: URL,
): AllowedPdfSource | null {
  try {
    const parsed = new URL(rawValue, requestUrl.origin);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    const pathPrefix = parsed.pathname.replace(/\/+$/, "") || "/";
    return {
      origin: parsed.origin,
      pathPrefix,
    };
  } catch {
    return null;
  }
}

function getAllowedPdfSources(requestUrl: URL) {
  const configuredValues = [
    requestUrl.origin,
    process.env.NEXT_PUBLIC_BASE_URL ?? "",
    process.env.AZURE_BLOB_PUBLIC_BASE_URL ?? "",
    ...readCsvEnv("VOICE_PDF_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("VOICE_PDF_ALLOWED_GCS_BUCKETS").map(
      (bucket) => `https://storage.googleapis.com/${bucket}`,
    ),
  ];

  const uniqueKeys = new Set<string>();
  const sources: AllowedPdfSource[] = [];

  for (const value of configuredValues) {
    const parsed = parseAllowedPdfSource(value, requestUrl);
    if (!parsed) {
      continue;
    }

    const key = `${parsed.origin}${parsed.pathPrefix}`;
    if (uniqueKeys.has(key)) {
      continue;
    }

    uniqueKeys.add(key);
    sources.push(parsed);
  }

  return sources;
}

function matchesAllowedPdfSource(url: URL, source: AllowedPdfSource) {
  if (url.origin !== source.origin) {
    return false;
  }

  if (source.pathPrefix === "/") {
    return true;
  }

  return (
    url.pathname === source.pathPrefix ||
    url.pathname.startsWith(`${source.pathPrefix}/`)
  );
}

function isAllowedPdfUrl(url: URL, requestUrl: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  return getAllowedPdfSources(requestUrl).some((source) =>
    matchesAllowedPdfSource(url, source),
  );
}

function buildPdfQuestionPrompt(input: z.infer<typeof PdfQuestionRequestSchema>) {
  const contextParts = [
    `Document title: ${input.fileName}.`,
    input.title ? `Current page title on ExamCooker: ${input.title}.` : null,
    input.currentPage && input.totalPages
      ? `The user is currently looking at page ${input.currentPage} of ${input.totalPages}.`
      : input.currentPage
        ? `The user is currently looking at page ${input.currentPage}.`
        : null,
    input.currentPage
      ? "When the question uses words like this, that, current, or here, interpret it as referring to the visible/current page."
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

function getSafePdfFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/[^\w .()[\]-]+/g, "_");
  if (!trimmed) return "document.pdf";
  return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
}

async function buildPdfFileInput(fileUrl: URL, fileName: string): Promise<PdfFileInput> {
  const fallback = {
    type: "input_file" as const,
    file_url: fileUrl.toString(),
  };

  try {
    const response = await fetch(fileUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return fallback;
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_INLINE_PDF_BYTES) {
      return fallback;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("pdf")) {
      return fallback;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_INLINE_PDF_BYTES) {
      return fallback;
    }

    return {
      type: "input_file",
      filename: getSafePdfFileName(fileName),
      file_data: buffer.toString("base64"),
    };
  } catch {
    return fallback;
  }
}

function schedulePdfAnswerCapture(input: {
  answer?: string | null;
  body: z.infer<typeof PdfQuestionRequestSchema>;
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

  const distinctId = input.distinctId;

  after(async () => {
    await capturePostHogAiGeneration({
      distinctId,
      traceId: input.body.voiceSessionId ?? crypto.randomUUID(),
      sessionId: input.body.posthogSessionId ?? undefined,
      spanId: crypto.randomUUID(),
      spanName: "voice_pdf_answer",
      model: DEFAULT_PDF_QA_MODEL,
      provider: "openai",
      input: [
        createAiTextMessage("system", PDF_ANSWER_SYSTEM_PROMPT),
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
        voice_pdf_title: input.body.title,
        voice_route_path: "/api/realtime/pdf-answer",
        voice_total_pages: input.body.totalPages,
      },
    });
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      {
        error: "You must be signed in to use voice document answers.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Missing OPENAI_API_KEY.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let parsedBody: z.infer<typeof PdfQuestionRequestSchema>;

  try {
    const requestBody = await request.json();
    parsedBody = PdfQuestionRequestSchema.parse(requestBody);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid PDF question request.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const fileUrl = new URL(parsedBody.fileUrl);
  if (!isAllowedPdfUrl(fileUrl, request.nextUrl)) {
    return NextResponse.json(
      {
        error: "That PDF source is not allowed for voice document answers.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const inputPrompt = buildPdfQuestionPrompt(parsedBody);
  const pdfFileInput = await buildPdfFileInput(fileUrl, parsedBody.fileName);
  const llmStartedAt = Date.now();

  const upstreamResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_PDF_QA_MODEL,
      max_output_tokens: 180,
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: PDF_ANSWER_SYSTEM_PROMPT,
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
            pdfFileInput,
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
      "Failed to answer the PDF question.";

    schedulePdfAnswerCapture({
      body: parsedBody,
      distinctId: session.user.id ?? session.user.email ?? null,
      errorMessage: message,
      httpStatus: upstreamResponse.status,
      inputPrompt,
      latencySeconds,
      payload,
    });

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: upstreamResponse.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const answer = payload ? extractOutputText(payload) : null;
  if (!answer) {
    const message = payload?.incomplete_details?.reason
      ? `The PDF answer was incomplete: ${payload.incomplete_details.reason}.`
      : "OpenAI did not return a usable PDF answer.";

    schedulePdfAnswerCapture({
      body: parsedBody,
      distinctId: session.user.id ?? session.user.email ?? null,
      errorMessage: message,
      httpStatus: upstreamResponse.status,
      inputPrompt,
      latencySeconds,
      payload,
    });

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  schedulePdfAnswerCapture({
    answer,
    body: parsedBody,
    distinctId: session.user.id ?? session.user.email ?? null,
    httpStatus: upstreamResponse.status,
    inputPrompt,
    latencySeconds,
    payload,
  });

  return NextResponse.json(
    {
      answer,
      currentPage: parsedBody.currentPage ?? null,
      fileName: parsedBody.fileName,
      totalPages: parsedBody.totalPages ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
