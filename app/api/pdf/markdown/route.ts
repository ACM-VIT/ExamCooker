import { NextResponse, type NextRequest } from "next/server";
import { Output, streamText } from "ai";
import { z } from "zod";
import { auth } from "@/app/auth";
import {
  PdfPaperDocumentSchema,
  PdfPaperQuestionSchema,
  buildPdfPaperMarkdown,
  getPdfMarkdownModel,
} from "@/lib/ai/pdf-markdown";
import type { PdfPaperQuestion } from "@/lib/ai/pdf-markdown";

const MAX_PDF_MARKDOWN_BYTES = 24 * 1024 * 1024;
const PDF_MARKDOWN_SYSTEM_PROMPT = [
  "You extract only the exam questions from ExamCooker question-paper PDFs.",
  "Ignore and discard all cover-page metadata, institution/course details, course code, course name, slot, registration fields, faculty names, course outcomes, general instructions, page separators, CO columns, and Bloom taxonomy columns.",
  "Your output must contain only question number, question text, and marks.",
  "If the source has a table with columns like Q. No, Question, M, CO, and BL, keep Q. No as number, Question as text, M as marks, and drop CO/BL.",
  "Do not solve, summarize, explain, reword, or add content that is not present in the PDF.",
  "Preserve questions in reading order. Merge continuation lines or rows into the same question when a question spans pages.",
  "Preserve subparts, options, formulas, equations, and tables that are part of the question text. Use Markdown for math, lists, tables, and code where helpful.",
  "For math, use valid LaTeX delimiters: `$...$` for inline math and `$$...$$` for display math. Do not escape the dollar delimiters and do not double-escape LaTeX backslashes.",
  "Use [illegible] only for characters or words that are truly unreadable. Do not guess missing marks.",
].join("\n");

const PdfMarkdownRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  fileUrl: z.string().trim().url(),
});

type AllowedPdfSource = {
  origin: string;
  pathPrefix: string;
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
  if (!session?.user?.email) {
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

  const model = getPdfMarkdownModel();

  try {
    const result = streamText({
      model,
      system: PDF_MARKDOWN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Extract only the questions from ${parsedBody.fileName}. ` +
                "Return no metadata and no instructions.",
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
      temperature: 0,
      maxOutputTokens: 12000,
      experimental_include: {
        requestBody: false,
      },
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        try {
          const streamedQuestions: PdfPaperQuestion[] = [];

          for await (const question of result.elementStream) {
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
          const paper = PdfPaperDocumentSchema.parse({
            schemaVersion: "exam-questions-v1",
            questions,
          });
          enqueue({
            type: "done",
            paper,
            markdown: buildPdfPaperMarkdown(paper),
            model,
          });
        } catch (error) {
          enqueue({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to convert this PDF to Markdown.",
          });
        } finally {
          controller.close();
        }
      },
      cancel() {
        request.signal.throwIfAborted();
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
        "X-ExamCooker-AI-Model": model,
      },
    });
  } catch (error) {
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
