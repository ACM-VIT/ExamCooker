import { after, NextResponse, type NextRequest } from "next/server";
import { Output, streamText } from "ai";
import { z } from "zod";
import { auth } from "@/app/auth";
import {
  PdfPaperDocumentSchema,
  PdfPaperQuestionSchema,
  buildPdfPaperMarkdown,
  getPdfMarkdownLanguageModel,
  getPdfMarkdownModel,
} from "@/lib/ai/pdf-markdown";
import type { PdfPaperQuestion } from "@/lib/ai/pdf-markdown";
import {
  getPdfMarkdownCacheKey,
  getPdfMarkdownContentHash,
  getPdfMarkdownPromptFingerprint,
  readPdfMarkdownCache,
  releasePdfMarkdownGenerationLock,
  storePdfMarkdownCache,
  tryAcquirePdfMarkdownGenerationLock,
  waitForPdfMarkdownCache,
} from "@/lib/ai/pdf-markdown-cache";
import type { PdfMarkdownCacheMetadata } from "@/lib/ai/pdf-markdown-cache-types";
import {
  capturePostHogAiGeneration,
  createAiTextMessage,
} from "@/lib/posthog/llm";
import {
  applyPdfPageEditsToBuffer,
  normalizePdfPageEdits,
} from "@/lib/pdf/page-edits";

const MAX_PDF_MARKDOWN_BYTES = 24 * 1024 * 1024;
const PDF_MARKDOWN_MAX_OUTPUT_TOKENS = 12000;
const POSTHOG_AI_TEXT_LIMIT = 8000;
const PDF_MARKDOWN_PROMPT_VERSION = "questions-only-v1";
const PdfPageRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
const PDF_MARKDOWN_SYSTEM_PROMPT = [
  "You are a careful transcription engine for ExamCooker question-paper PDFs.",
  "Extract only the exam questions. Ignore cover-page metadata, institution/course details, course code, course name, slot, registration fields, faculty names, course outcomes, page separators, general instructions, CO columns, and Bloom taxonomy columns.",
  "Use only text that is visibly present in the PDF pages. Do not use the filename, course title, subject knowledge, expected exam patterns, or surrounding context to fill missing words, marks, formulas, or question numbers.",
  "Your output must contain only question number, question text, and marks.",
  "Read every page in visual order: top-to-bottom and left-to-right, following table rows and continuation lines carefully. Preserve the source order exactly.",
  "If the source has a table with columns like Q. No, Question, M, CO, and BL, keep Q. No as number, Question as text, M as marks, and drop CO/BL.",
  "Keep question numbers and subpart labels exactly as shown, including forms like 1(a), 1. a), 2(i), or OR alternatives. Do not merge separate alternatives into one question unless the PDF clearly shows them as a single question block.",
  "Merge continuation lines or page-spanning rows only when they are clearly part of the same question. Do not merge unrelated rows, headings, instructions, or the next question into the current question.",
  "Transcribe the question text faithfully. Do not solve, summarize, explain, simplify, reword, correct grammar, normalize spelling, or add content that is not present in the PDF.",
  "Preserve symbols, variable names, numbers, options, units, punctuation, code, tables, formulas, and equations that are part of the question text. Use Markdown only to represent the visible structure more clearly.",
  "Pay special attention to visually similar characters in math, code, and identifiers, such as x/z, y/v, O/0, I/l/1, S/5, and Greek/Latin lookalikes. If a character is ambiguous, use `[illegible]` for that character or span instead of substituting the most likely one.",
  "For math, use valid LaTeX delimiters: `$...$` for inline math and `$$...$$` for display math. Do not escape the dollar delimiters and do not double-escape LaTeX backslashes.",
  "For marks, copy exactly the value shown in the marks or M column. If marks are missing, cropped, ambiguous, or only inferable from totals, use null. Never guess missing marks.",
  "If any word, number, symbol, formula, or mark is hard to read, write `[illegible]` for only that unreadable span instead of guessing. Prefer a small `[illegible]` marker over a confident but possibly wrong transcription.",
  "Before finishing, verify that the output contains no metadata, no instructions-only text, no CO/BL values, no solutions, no invented text, and no reordered questions.",
].join("\n");

const PdfMarkdownRequestSchema = z.object({
  cacheMode: z.enum(["default", "refresh"]).optional(),
  fileName: z.string().trim().min(1).max(240),
  fileUrl: z.string().trim().url(),
  pageEdits: z
    .object({
      pageOrder: z.array(z.number().int().min(0)).max(400).nullable().optional(),
      pageRotations: z
        .record(z.string().regex(/^\d+$/), PdfPageRotationSchema)
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  posthogSessionId: z.string().trim().min(1).max(200).nullable().optional(),
});

type AllowedPdfSource = {
  origin: string;
  pathPrefix: string;
};

type AiUsageSummary = {
  inputTokens?: number;
  outputTokens?: number;
};

type AiResponseSummary = {
  id?: string;
};

type PdfMarkdownAiCaptureEvent = {
  distinctId: string;
  error?: unknown;
  fileBytes: number;
  fileName: string;
  fileUrl: string;
  finishReason?: PromiseLike<string | undefined> | null;
  httpStatus: number;
  isError: boolean;
  latencySeconds: number;
  markdown?: string;
  modelId: string;
  outputWasTruncated?: boolean;
  provider: string;
  questionCount?: number;
  response?: PromiseLike<AiResponseSummary> | null;
  sessionId?: string;
  spanId: string;
  timeToFirstQuestionSeconds?: number;
  traceId: string;
  usage?: PromiseLike<AiUsageSummary> | null;
  userPrompt: string;
};

type PdfMarkdownDoneEvent = {
  cache: PdfMarkdownCacheMetadata;
  markdown: string;
  model: string;
  paper: z.infer<typeof PdfPaperDocumentSchema>;
  type: "done";
};

function getAzureBaseUrlFromEnv() {
  const explicitBaseUrl = process.env.AZURE_BLOB_PUBLIC_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const container = process.env.AZURE_STORAGE_CONTAINER?.trim();
  if (!container) {
    return "";
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  if (connectionString) {
    const segments = new Map<string, string>();
    for (const part of connectionString.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      segments.set(
        trimmed.slice(0, separatorIndex).trim(),
        trimmed.slice(separatorIndex + 1).trim(),
      );
    }

    const blobEndpoint = segments.get("BlobEndpoint");
    if (blobEndpoint) {
      return `${blobEndpoint.replace(/\/+$/, "")}/${container}`;
    }

    const accountName = segments.get("AccountName");
    const endpointSuffix = segments.get("EndpointSuffix") || "core.windows.net";
    if (accountName) {
      return `https://${accountName}.blob.${endpointSuffix}/${container}`;
    }
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  if (!accountName) {
    return "";
  }

  return `https://${accountName}.blob.core.windows.net/${container}`;
}

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
  const azureBaseUrls = [
    getAzureBaseUrlFromEnv(),
    "https://examcookerdevsi.blob.core.windows.net/exam-assets",
    "https://examcookerprodsi.blob.core.windows.net/exam-assets",
  ];
  const configuredValues = [
    requestUrl.origin,
    process.env.NEXT_PUBLIC_BASE_URL ?? "",
    ...azureBaseUrls,
    ...readCsvEnv("PDF_MARKDOWN_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("VOICE_PDF_ALLOWED_URL_PREFIXES"),
    ...readCsvEnv("PDF_MARKDOWN_ALLOWED_GCS_BUCKETS").map(
      (bucket) => `https://storage.googleapis.com/${bucket}`,
    ),
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

function getSafePdfFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/[^\w .()[\]-]+/g, "_");
  if (!trimmed) return "document.pdf";
  return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function getStreamErrorMessage(error: unknown, streamError: unknown) {
  const fallbackMessage = getErrorMessage(error);
  if (streamError) {
    return getErrorMessage(streamError) || fallbackMessage;
  }

  return fallbackMessage || "Failed to convert this PDF to Markdown.";
}

function getIncompletePdfMarkdownMessage(finishReason: string | undefined) {
  if (finishReason !== "length") {
    return null;
  }

  return "The Markdown conversion was cut off before it finished. Try a smaller PDF or fewer edited pages.";
}

function getAiProviderFromModel(modelId: string) {
  const [provider] = modelId.split("/");
  return provider && provider !== modelId ? provider : "openai";
}

function truncateForPostHogAiText(text: string) {
  if (text.length <= POSTHOG_AI_TEXT_LIMIT) {
    return {
      text,
      wasTruncated: false,
    };
  }

  return {
    text: text.slice(0, POSTHOG_AI_TEXT_LIMIT),
    wasTruncated: true,
  };
}

function createDoneStreamResponse(
  event: PdfMarkdownDoneEvent,
  headers?: HeadersInit,
) {
  return new Response(`${JSON.stringify(event)}\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-ExamCooker-AI-Model": event.model,
      ...headers,
    },
  });
}

async function safeAwait<T>(promise: PromiseLike<T> | null | undefined) {
  if (!promise) {
    return null;
  }

  try {
    return await promise;
  } catch {
    return null;
  }
}

function schedulePdfMarkdownAiCapture(
  captureEventPromise: Promise<PdfMarkdownAiCaptureEvent | null>,
) {
  after(async () => {
    const captureEvent = await captureEventPromise.catch(() => null);
    if (!captureEvent) {
      return;
    }

    const usage = await safeAwait(captureEvent.usage);
    const response = await safeAwait(captureEvent.response);
    const finishReason = await safeAwait(captureEvent.finishReason);
    const outputText = captureEvent.markdown
      ? truncateForPostHogAiText(captureEvent.markdown)
      : null;

    await capturePostHogAiGeneration({
      distinctId: captureEvent.distinctId,
      traceId: captureEvent.traceId,
      sessionId: captureEvent.sessionId,
      spanId: response?.id ?? captureEvent.spanId,
      spanName: "pdf_markdown_extraction",
      model: captureEvent.modelId,
      provider: captureEvent.provider,
      input: [
        createAiTextMessage("system", PDF_MARKDOWN_SYSTEM_PROMPT),
        {
          role: "user",
          content: [
            {
              type: "text",
              text: captureEvent.userPrompt,
            },
            {
              type: "file",
              mediaType: "application/pdf",
              filename: getSafePdfFileName(captureEvent.fileName),
              bytes: captureEvent.fileBytes,
            },
          ],
        },
      ],
      inputTokens: usage?.inputTokens,
      outputChoices: outputText
        ? [createAiTextMessage("assistant", outputText.text)]
        : undefined,
      outputTokens: usage?.outputTokens,
      latencySeconds: captureEvent.latencySeconds,
      httpStatus: captureEvent.httpStatus,
      isError: captureEvent.isError,
      error: captureEvent.error,
      stopReason:
        finishReason ?? (captureEvent.isError ? "error" : undefined),
      stream: true,
      maxTokens: PDF_MARKDOWN_MAX_OUTPUT_TOKENS,
      extraProperties: {
        ai_surface: "pdf_markdown",
        pdf_markdown_file_bytes: captureEvent.fileBytes,
        pdf_markdown_file_name: captureEvent.fileName,
        pdf_markdown_file_url: captureEvent.fileUrl,
        pdf_markdown_output_truncated:
          captureEvent.outputWasTruncated ?? outputText?.wasTruncated,
        pdf_markdown_question_count: captureEvent.questionCount,
        pdf_markdown_time_to_first_question:
          captureEvent.timeToFirstQuestionSeconds,
      },
    });
  });
}

async function fetchPdfBuffer(fileUrl: URL) {
  const response = await fetch(fileUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`PDF request failed with ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PDF_MARKDOWN_BYTES) {
    throw new Error("This PDF is too large to convert to Markdown.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("pdf")) {
    throw new Error("That URL did not return a PDF.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("The PDF file is empty.");
  }

  if (buffer.byteLength > MAX_PDF_MARKDOWN_BYTES) {
    throw new Error("This PDF is too large to convert to Markdown.");
  }

  return buffer;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const distinctId = session?.user?.id ?? session?.user?.email ?? null;
  if (!distinctId) {
    return NextResponse.json(
      {
        error: "You must be signed in to convert PDFs to Markdown.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let parsedBody: z.infer<typeof PdfMarkdownRequestSchema>;

  try {
    const requestBody = await request.json();
    parsedBody = PdfMarkdownRequestSchema.parse(requestBody);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid PDF Markdown request.",
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
        error: "That PDF source is not allowed for Markdown conversion.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await fetchPdfBuffer(fileUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load the PDF.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const modelId = getPdfMarkdownModel();
  const provider = getAiProviderFromModel(modelId);
  const normalizedPageEdits = normalizePdfPageEdits(
    parsedBody.pageEdits ?? null,
  );

  if (normalizedPageEdits) {
    try {
      pdfBuffer = Buffer.from(
        await applyPdfPageEditsToBuffer(pdfBuffer, normalizedPageEdits),
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to apply saved PDF page fixes.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  const contentHash = getPdfMarkdownContentHash(pdfBuffer);
  const promptFingerprint = getPdfMarkdownPromptFingerprint(
    [PDF_MARKDOWN_PROMPT_VERSION, PDF_MARKDOWN_SYSTEM_PROMPT].join("\n"),
  );
  const cacheKey = getPdfMarkdownCacheKey({
    contentHash,
    modelId,
    promptFingerprint,
  });
  const cacheLookupInput = {
    cacheKey,
    contentHash,
    modelId,
    promptFingerprint,
    voterId: distinctId,
  };
  const cacheMode = parsedBody.cacheMode ?? "default";
  let cacheMetadata: PdfMarkdownCacheMetadata | null = null;
  let generationLockToken: string | null = null;

  if (cacheMode !== "refresh") {
    const cached = await readPdfMarkdownCache(cacheLookupInput);
    cacheMetadata = cached.metadata;

    if (cached.type === "hit") {
      return createDoneStreamResponse(
        {
          cache: cached.metadata,
          markdown: cached.entry.markdown,
          model: modelId,
          paper: cached.entry.paper,
          type: "done",
        },
        {
          "X-ExamCooker-Markdown-Cache": "hit",
        },
      );
    }

    if (cached.type !== "disabled") {
      generationLockToken = await tryAcquirePdfMarkdownGenerationLock(cacheKey);
      if (!generationLockToken) {
        const waited = await waitForPdfMarkdownCache(cacheLookupInput);
        if (waited) {
          return createDoneStreamResponse(
            {
              cache: waited.metadata,
              markdown: waited.entry.markdown,
              model: modelId,
              paper: waited.entry.paper,
              type: "done",
            },
            {
              "X-ExamCooker-Markdown-Cache": "hit-waited",
            },
          );
        }
      }
    }
  }

  const model = getPdfMarkdownLanguageModel();
  const traceId = crypto.randomUUID();
  const spanId = crypto.randomUUID();
  const userPrompt =
    `Extract only the questions from ${parsedBody.fileName}. ` +
    "Return no metadata and no instructions.";

  try {
    let streamError: unknown = null;
    const llmStartedAt = Date.now();
    let firstQuestionAt: number | null = null;
    let resolveCaptureEvent:
      | ((event: PdfMarkdownAiCaptureEvent | null) => void)
      | null = null;
    const captureEventPromise = new Promise<PdfMarkdownAiCaptureEvent | null>(
      (resolve) => {
        resolveCaptureEvent = resolve;
      },
    );
    const resolveCaptureEventOnce = (
      event: PdfMarkdownAiCaptureEvent | null,
    ) => {
      if (!resolveCaptureEvent) {
        return;
      }

      resolveCaptureEvent(event);
      resolveCaptureEvent = null;
    };

    const result = streamText({
      model,
      system: PDF_MARKDOWN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "file",
              mediaType: "application/pdf",
              data: pdfBuffer,
              filename: getSafePdfFileName(parsedBody.fileName),
            },
          ],
        },
      ],
      output: Output.array({
        element: PdfPaperQuestionSchema,
        name: "exam_questions",
        description:
          "A faithful ordered list of only question numbers, question text, and marks.",
      }),
      abortSignal: request.signal,
      maxOutputTokens: PDF_MARKDOWN_MAX_OUTPUT_TOKENS,
      experimental_include: {
        requestBody: false,
      },
      onError: ({ error }) => {
        streamError = error;
        console.error("[pdf-markdown] stream error", error);
      },
      providerOptions: {
        openai: {
          store: false,
        },
      },
    });

    schedulePdfMarkdownAiCapture(captureEventPromise);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        let finishReason: string | undefined;

        try {
          const streamedQuestions: PdfPaperQuestion[] = [];

          for await (const question of result.elementStream) {
            if (firstQuestionAt === null) {
              firstQuestionAt = Date.now();
            }

            streamedQuestions.push(question);
            enqueue({
              type: "partial",
              paper: {
                schemaVersion: "exam-questions-v1",
                questions: streamedQuestions,
              },
            });
          }

          const questions = await result.output;
          finishReason = (await result.finishReason) ?? undefined;
          const incompleteMessage = getIncompletePdfMarkdownMessage(finishReason);
          if (incompleteMessage) {
            throw new Error(incompleteMessage);
          }

          const paper = PdfPaperDocumentSchema.parse({
            schemaVersion: "exam-questions-v1",
            questions,
          });
          const markdown = buildPdfPaperMarkdown(paper);
          const storedCacheMetadata = await storePdfMarkdownCache({
            cacheKey,
            contentHash,
            fileName: parsedBody.fileName,
            fileUrl: fileUrl.href,
            markdown,
            modelId,
            paper,
            promptFingerprint,
          });
          const responseCacheMetadata =
            cacheMetadata?.status === "bypassed" &&
            storedCacheMetadata.status === "stored"
              ? {
                  ...storedCacheMetadata,
                  reason: "replaced_flagged_generation",
                }
              : storedCacheMetadata;
          enqueue({
            cache: responseCacheMetadata,
            type: "done",
            paper,
            markdown,
            model: modelId,
          });
          resolveCaptureEventOnce({
            distinctId,
            fileBytes: pdfBuffer.byteLength,
            fileName: parsedBody.fileName,
            fileUrl: fileUrl.href,
            finishReason: Promise.resolve(finishReason),
            httpStatus: 200,
            isError: false,
            latencySeconds: Math.max(Date.now() - llmStartedAt, 0) / 1000,
            markdown,
            modelId,
            provider,
            questionCount: paper.questions.length,
            response: result.response,
            sessionId: parsedBody.posthogSessionId ?? undefined,
            spanId,
            timeToFirstQuestionSeconds:
              firstQuestionAt === null
                ? undefined
                : Math.max(firstQuestionAt - llmStartedAt, 0) / 1000,
            traceId,
            usage: result.totalUsage,
            userPrompt,
          });
        } catch (error) {
          const errorMessage = getStreamErrorMessage(error, streamError);
          enqueue({
            type: "error",
            error: errorMessage,
          });
          resolveCaptureEventOnce({
            distinctId,
            error: errorMessage,
            fileBytes: pdfBuffer.byteLength,
            fileName: parsedBody.fileName,
            fileUrl: fileUrl.href,
            finishReason:
              finishReason === undefined ? result.finishReason : Promise.resolve(finishReason),
            httpStatus: request.signal.aborted ? 499 : 500,
            isError: true,
            latencySeconds: Math.max(Date.now() - llmStartedAt, 0) / 1000,
            modelId,
            provider,
            sessionId: parsedBody.posthogSessionId ?? undefined,
            spanId,
            timeToFirstQuestionSeconds:
              firstQuestionAt === null
                ? undefined
                : Math.max(firstQuestionAt - llmStartedAt, 0) / 1000,
            traceId,
            userPrompt,
          });
        } finally {
          resolveCaptureEventOnce(null);
          await releasePdfMarkdownGenerationLock(
            cacheKey,
            generationLockToken,
          );
          controller.close();
        }
      },
      async cancel() {
        resolveCaptureEventOnce({
          distinctId,
          error: "PDF Markdown conversion was cancelled.",
          fileBytes: pdfBuffer.byteLength,
          fileName: parsedBody.fileName,
          fileUrl: fileUrl.href,
          httpStatus: 499,
          isError: true,
          latencySeconds: Math.max(Date.now() - llmStartedAt, 0) / 1000,
          modelId,
          provider,
          sessionId: parsedBody.posthogSessionId ?? undefined,
          spanId,
          timeToFirstQuestionSeconds:
            firstQuestionAt === null
              ? undefined
              : Math.max(firstQuestionAt - llmStartedAt, 0) / 1000,
          traceId,
          userPrompt,
        });
        await releasePdfMarkdownGenerationLock(cacheKey, generationLockToken);
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
        "X-ExamCooker-AI-Model": modelId,
        "X-ExamCooker-Markdown-Cache":
          cacheMetadata?.status === "bypassed" ? "bypassed" : "miss",
      },
    });
  } catch (error) {
    await releasePdfMarkdownGenerationLock(cacheKey, generationLockToken);

    if (request.signal.aborted) {
      return NextResponse.json(
        {
          error: "PDF Markdown conversion was cancelled.",
        },
        {
          status: 499,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to convert this PDF to Markdown.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
