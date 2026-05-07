"use client";

import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF, useDocumentState } from "@embedpdf/core/react";
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from "@embedpdf/plugin-document-manager/react";
import {
  RenderPluginPackage,
  useRenderCapability,
} from "@embedpdf/plugin-render/react";
import {
  Scroller,
  ScrollPluginPackage,
  ScrollStrategy,
  useScroll,
} from "@embedpdf/plugin-scroll/react";
import { Viewport, ViewportPluginPackage } from "@embedpdf/plugin-viewport/react";
import {
  ZoomMode,
  ZoomPluginPackage,
  useZoom,
} from "@embedpdf/plugin-zoom/react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  Eye,
  FileText,
  Maximize2,
  Minimize2,
  Moon,
  Minus,
  Plus,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Streamdown,
  type Components as StreamdownComponents,
  type PluginConfig as StreamdownPluginConfig,
} from "streamdown";
import type { PdfPaperDocument } from "@/lib/ai/pdf-markdown";
import { downloadPdfFile } from "@/lib/downloads/browser-downloads";
import { getFallbackPdfFileName } from "@/lib/downloads/resource-names";
import { invalidatePdfBuffer, loadPdfBuffer } from "@/lib/pdf/pdf-buffer-cache";
import { usePreloadedPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
import { capturePdfDownloaded, getPostHogSessionId } from "@/lib/posthog/client";
import {
  clearActivePdfSnapshot,
  setActivePdfSnapshot,
} from "@/app/components/voice/pdf-voice-context";

const TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-600 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus-visible:ring-gray-500";
const PAGE_INPUT_CLASS =
  "h-8 w-12 rounded border border-gray-300 bg-white px-1 text-center text-sm tabular-nums text-gray-700 outline-none transition focus:border-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 sm:w-14";
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const SLOW_LOAD_NOTICE_MS = 3500;
const PDF_DARK_MODE_FILTER =
  "invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.95)";
const PDF_MARKDOWN_ENDPOINT = "/api/pdf/markdown";
const MARKDOWN_ACTION_BUTTON_CLASS =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800";
const STREAMDOWN_MATH_PLUGIN = createMathPlugin({
  singleDollarTextMath: true,
});
const STREAMDOWN_PLUGINS = {
  cjk,
  code,
  math: STREAMDOWN_MATH_PLUGIN,
  mermaid,
} satisfies StreamdownPluginConfig;

type PaperViewMode = "pdf" | "paper";
type PaperStatus = "idle" | "loading" | "ready" | "error";
type CopyStatus = "idle" | "copying" | "copied";

type PdfPaperResponse = {
  paper: PdfPaperDocument;
  markdown: string;
  model?: string;
};

type PdfPaperStreamEvent =
  | { type: "partial"; paper?: unknown }
  | { type: "done"; paper: PdfPaperDocument; markdown: string; model?: string }
  | { type: "error"; error?: string };

type PdfBufferState =
  | { status: "loading"; progress: number | null }
  | { status: "loaded"; buffer: ArrayBuffer }
  | { status: "error"; message: string };

const MARKDOWN_COMPONENTS: StreamdownComponents = {
  h1: ({ children }) => (
    <h1 className="mt-0 border-b border-black/10 pb-2 text-xl font-bold leading-tight text-gray-950 dark:border-white/10 dark:text-gray-50">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 text-lg font-bold leading-snug text-gray-950 dark:text-gray-50">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-base font-bold leading-snug text-gray-950 dark:text-gray-50">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-3 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-gray-300 pl-4 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-r border-black/10 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-900 last:border-r-0 dark:border-white/10 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-r border-black/10 px-3 py-2 align-top text-gray-800 last:border-r-0 dark:border-white/10 dark:text-gray-200">
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto bg-gray-950 p-4 text-xs leading-6 text-gray-100">
      {children}
    </pre>
  ),
  inlineCode: ({ children }) => (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.85em] font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </code>
  ),
};

async function getJsonResponseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Fall back to plain text below.
  }

  const text = await response.text().catch(() => "");
  return text.trim() || "Failed to convert this PDF to Markdown.";
}

async function loadPdfPaper(input: {
  fileName: string;
  fileUrl: string;
  onPartial?: (paper: PdfPaperDocument) => void;
  signal: AbortSignal;
}): Promise<PdfPaperResponse> {
  const response = await fetch(PDF_MARKDOWN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      posthogSessionId: getPostHogSessionId(),
    }),
    cache: "no-store",
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(await getJsonResponseErrorMessage(response));
  }

  if (!response.body) {
    throw new Error("The Markdown conversion stream did not start.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedText = "";
  let finalPayload: PdfPaperResponse | null = null;

  const handleEvent = (event: PdfPaperStreamEvent) => {
    if (event.type === "partial") {
      const partialPaper = normalizePartialPaper(event.paper);
      if (partialPaper) {
        input.onPartial?.(partialPaper);
      }
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error || "Failed to convert this PDF to Markdown.");
    }

    if (event.type === "done") {
      finalPayload = {
        markdown: event.markdown,
        model: event.model,
        paper: event.paper,
      };
    }
  };

  const flushLine = (line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }

    handleEvent(JSON.parse(trimmedLine) as PdfPaperStreamEvent);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    bufferedText += decoder.decode(value, { stream: true });

    let newlineIndex = bufferedText.indexOf("\n");
    while (newlineIndex !== -1) {
      flushLine(bufferedText.slice(0, newlineIndex));
      bufferedText = bufferedText.slice(newlineIndex + 1);
      newlineIndex = bufferedText.indexOf("\n");
    }
  }

  bufferedText += decoder.decode();
  flushLine(bufferedText);

  if (!finalPayload) {
    throw new Error("The Markdown conversion ended before returning a paper.");
  }

  return finalPayload;
}

function normalizePartialPaper(value: unknown): PdfPaperDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) {
    return null;
  }

  const normalizedQuestions = questions
    .map((question, index) => {
      if (!question || typeof question !== "object") {
        return null;
      }

      const record = question as {
        marks?: unknown;
        number?: unknown;
        text?: unknown;
      };
      const number =
        typeof record.number === "string" && record.number.trim()
          ? record.number
          : String(index + 1);
      const text = typeof record.text === "string" ? record.text : "";
      const marks =
        typeof record.marks === "string"
          ? record.marks
          : record.marks === null
            ? null
            : null;

      if (!text.trim() && !number.trim()) {
        return null;
      }

      return {
        marks,
        number,
        text,
      };
    })
    .filter((question): question is PdfPaperDocument["questions"][number] =>
      Boolean(question),
    );

  if (!normalizedQuestions.length) {
    return null;
  }

  return {
    questions: normalizedQuestions,
    schemaVersion: "exam-questions-v1",
  };
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }
}

function LoadingState({
  label,
  fileUrl,
  progress,
  showFallback = false,
  onRetry,
}: {
  label: string;
  fileUrl?: string;
  progress?: number | null;
  showFallback?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-gray-100 px-4 text-center text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-300">
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full w-1/3 animate-pulse rounded-full bg-gray-900 dark:bg-gray-100"
            style={
              typeof progress === "number"
                ? { width: `${Math.min(Math.max(progress, 3), 100)}%` }
                : undefined
            }
          />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-700 dark:text-gray-100">{label}</p>
          {showFallback ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Taking longer than usual. Open the original PDF, or retry the
              viewer.
            </p>
          ) : null}
        </div>
        {showFallback && fileUrl ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded border border-black/15 bg-white px-3 py-1.5 font-semibold text-black transition hover:border-black/30 dark:border-white/15 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-white/30"
              >
                Retry
              </button>
            ) : null}
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-black px-3 py-1.5 font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              Open original
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ErrorState({
  fileUrl,
  message = "PDF viewer failed to load.",
  onRetry,
}: {
  fileUrl: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 bg-gray-100 px-4 text-center text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300">
      <p>{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-black/15 bg-white px-3 py-1.5 font-semibold text-black transition hover:border-black/30 dark:border-white/15 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-white/30"
          >
            Retry viewer
          </button>
        ) : null}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-black px-3 py-1.5 font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Open original
        </a>
      </div>
    </div>
  );
}

const PAPER_TEXT_COMPONENTS: StreamdownComponents = {
  ...MARKDOWN_COMPONENTS,
  h1: ({ children }) => (
    <h3 className="my-2 text-xl font-semibold leading-snug text-inherit">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="my-2 text-lg font-semibold leading-snug text-inherit">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="my-2 text-base font-semibold leading-snug text-inherit">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="my-2 text-[17px] leading-8 text-inherit">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[17px] leading-8 text-inherit">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[17px] leading-8 text-inherit">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-current/20 pl-4 text-[16px] leading-7 text-inherit">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto border border-current/15">
      <table className="w-full min-w-[480px] border-collapse text-[15px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-r border-current/15 bg-current/5 px-3 py-2 text-left font-semibold text-inherit last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-r border-current/15 px-3 py-2 align-top text-inherit last:border-r-0">
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto border border-current/15 bg-current/5 p-4 font-mono text-xs leading-6 text-inherit">
      {children}
    </pre>
  ),
  inlineCode: ({ children }) => (
    <code className="border border-current/15 bg-current/5 px-1 py-0.5 font-mono text-[0.85em] text-inherit">
      {children}
    </code>
  ),
};

function AiPaperLoadingState() {
  return (
    <div className="flex min-h-full flex-1 bg-white text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <article className="ec-markdown-loading-shell flex min-h-full w-full flex-col bg-white dark:bg-[#0C1222]">
        <div className="relative h-0.5 overflow-hidden bg-black/10 dark:bg-[#D5D5D5]/10">
          <div className="ec-markdown-progress absolute inset-y-0 left-0 w-1/3 bg-[#5FC4E7] dark:bg-[#3BF4C7]" />
        </div>

        <header className="border-b border-black/10 px-6 py-4 dark:border-[#D5D5D5]/10 sm:px-10">
          <p className="text-sm font-semibold">Preparing paper text</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-black/55 dark:text-[#D5D5D5]/60">
            Keeping layout, questions, and marks intact.
          </p>
        </header>

        <div className="flex flex-1 justify-center overflow-hidden px-6 py-8 sm:px-10 lg:px-14">
          <div className="w-full max-w-[900px]">
            <div className="border-b border-black/10 pb-7 text-center dark:border-[#D5D5D5]/10">
              <div className="ec-markdown-skeleton mx-auto h-8 w-36 bg-black/10 dark:bg-[#D5D5D5]/12" />
            </div>

            <div className="divide-y divide-black/10 dark:divide-[#D5D5D5]/10">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="grid gap-3 py-7 sm:grid-cols-[3.25rem_minmax(0,1fr)_5.5rem]"
                >
                  <div className="ec-markdown-skeleton h-5 w-7 bg-black/15 dark:bg-[#D5D5D5]/15" />
                  <div className="min-w-0 space-y-3">
                    <div className="ec-markdown-skeleton h-3 w-full bg-black/10 dark:bg-[#D5D5D5]/10" />
                    <div className="ec-markdown-skeleton h-3 w-11/12 bg-black/10 dark:bg-[#D5D5D5]/10" />
                    <div className="ec-markdown-skeleton h-3 w-8/12 bg-black/10 dark:bg-[#D5D5D5]/10" />
                  </div>
                  <div className="ec-markdown-skeleton hidden h-3 w-14 justify-self-end bg-black/10 dark:bg-[#D5D5D5]/10 sm:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function AiPaperErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-4 text-center">
      <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
      <p className="max-w-lg text-sm font-medium text-gray-800 dark:text-gray-200">
        {errorMessage ?? "Markdown conversion failed."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-gray-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
      >
        Retry
      </button>
    </div>
  );
}

function AiPaperView({
  errorMessage,
  isDarkMode,
  paper,
  status,
  onRetry,
}: {
  errorMessage: string | null;
  isDarkMode: boolean;
  paper: PdfPaperDocument | null;
  status: PaperStatus;
  onRetry: () => void;
}) {
  const hasQuestions = Boolean(paper?.questions.length);

  if ((status === "loading" || status === "idle") && !hasQuestions) {
    return (
      <div className="min-h-0 flex flex-1 overflow-auto bg-white dark:bg-[#0C1222]">
        <AiPaperLoadingState />
      </div>
    );
  }

  if (status === "error" || !paper) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <AiPaperErrorState errorMessage={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  const pageShellClass = isDarkMode
    ? "bg-[hsl(224,48%,9%)] text-[#D5D5D5]"
    : "bg-[#C2E6EC] text-black";
  const pageClass = isDarkMode
    ? "border-[#D5D5D5]/15 bg-[#0C1222] text-[#D5D5D5] shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]"
    : "border-black/10 bg-white text-gray-950 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]";
  const ruleClass = isDarkMode ? "border-[#D5D5D5]/10" : "border-black/10";
  const mutedTextClass = isDarkMode ? "text-[#D5D5D5]/60" : "text-black/55";

  return (
    <div className={`ec-markdown-surface min-h-0 flex-1 overflow-auto px-3 py-5 sm:px-6 ${pageShellClass}`}>
      <article
        className={`ec-markdown-page mx-auto min-h-full w-full max-w-[900px] border px-6 py-8 sm:px-10 lg:px-14 ${pageClass}`}
      >
        <header className={`border-b pb-7 text-center ${ruleClass}`}>
          <h1 className="font-serif text-3xl font-semibold leading-tight">
            Questions
          </h1>
        </header>

        <div className={`divide-y ${ruleClass}`}>
          {paper.questions.map((question, index) => (
            <section
              key={`${question.number}-${question.text}`}
              className="ec-markdown-question grid gap-3 py-7 sm:grid-cols-[3.25rem_minmax(0,1fr)_5.5rem]"
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
            >
              <div className="pt-1 font-serif text-lg font-semibold tabular-nums">
                {question.number}
              </div>
              <div className="min-w-0 font-serif text-[17px] leading-8">
                <Streamdown
                  components={PAPER_TEXT_COMPONENTS}
                  controls
                  mode="static"
                  plugins={STREAMDOWN_PLUGINS}
                >
                  {question.text}
                </Streamdown>
              </div>
              <div className={`pt-2 font-serif text-sm italic sm:text-right ${mutedTextClass}`}>
                {question.marks?.trim() ? (
                  <span>({question.marks} marks)</span>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );

}

function PageRenderLayer({
  documentId,
  isPdfDarkMode,
  pageIndex,
}: {
  documentId: string;
  isPdfDarkMode: boolean;
  pageIndex: number;
}) {
  const { provides: renderProvides } = useRenderCapability();
  const documentState = useDocumentState(documentId);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const refreshVersion = documentState?.pageRefreshVersions[pageIndex] ?? 0;

  useEffect(() => {
    if (!renderProvides || documentState?.status !== "loaded") return;

    let isCurrentRender = true;
    const task = renderProvides.forDocument(documentId).renderPage({
      pageIndex,
      options: {
        scaleFactor: documentState.scale || 1,
        rotation: documentState.rotation,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      },
    });

    task
      .toPromise()
      .then((blob) => {
        if (!isCurrentRender) return;

        const nextImageUrl = URL.createObjectURL(blob);
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
        }
        imageUrlRef.current = nextImageUrl;
        setImageUrl(nextImageUrl);
      })
      .catch((renderError) => {
        if (!isCurrentRender) return;
        console.error("[PDFViewer] Page render failed", {
          documentId,
          pageIndex,
          renderError,
        });
      });

    return () => {
      isCurrentRender = false;
    };
  }, [
    documentId,
    documentState?.rotation,
    documentState?.scale,
    documentState?.status,
    pageIndex,
    refreshVersion,
    renderProvides,
    imageUrlRef,
  ]);

  useEffect(
    () => () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    },
    [imageUrlRef]
  );

  if (!imageUrl) return null;

  return (
    <img
      src={imageUrl}
      alt=""
      className="absolute inset-0 h-full w-full select-none object-fill"
      draggable={false}
      style={isPdfDarkMode ? { filter: PDF_DARK_MODE_FILTER } : undefined}
    />
  );
}

function ViewerToolbar({
  documentId,
  enableQuestionMarkdown,
  fileUrl,
  fileName,
  isFullScreen,
  isPdfDarkMode,
  viewMode,
  paperStatus,
  copyStatus,
  onCopyMarkdown,
  onShowPdf,
  onTogglePdfDarkMode,
  onToggleFullScreen,
  onViewMarkdown,
}: {
  documentId: string;
  enableQuestionMarkdown: boolean;
  fileUrl: string;
  fileName: string;
  isFullScreen: boolean;
  isPdfDarkMode: boolean;
  viewMode: PaperViewMode;
  paperStatus: PaperStatus;
  copyStatus: CopyStatus;
  onCopyMarkdown: () => void;
  onShowPdf: () => void;
  onTogglePdfDarkMode: () => void;
  onToggleFullScreen: () => void;
  onViewMarkdown: () => void;
}) {
  const [pageInput, setPageInput] = useState("1");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMarkdownMenuOpen, setIsMarkdownMenuOpen] = useState(false);
  const [isMarkdownTooltipVisible, setIsMarkdownTooltipVisible] = useState(true);
  const markdownTooltipId = useId();
  const markdownMenuRef = useRef<HTMLDivElement>(null);
  const { provides: scrollControls, state: scrollState } = useScroll(documentId);
  const { provides: zoomControls, state: zoomState } = useZoom(documentId);
  const currentPage = scrollState.currentPage || 1;
  const totalPages = Math.max(scrollState.totalPages || 1, 1);
  const zoomPercent = Math.round((zoomState.currentZoomLevel || 1) * 100);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!isMarkdownMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        markdownMenuRef.current &&
        !markdownMenuRef.current.contains(event.target as Node)
      ) {
        setIsMarkdownMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMarkdownMenuOpen]);

  useEffect(() => {
    if (
      !enableQuestionMarkdown ||
      !isMarkdownTooltipVisible ||
      isMarkdownMenuOpen
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMarkdownTooltipVisible(false);
    }, 6500);

    return () => window.clearTimeout(timeoutId);
  }, [enableQuestionMarkdown, isMarkdownMenuOpen, isMarkdownTooltipVisible]);

  const scrollToPage = useCallback(
    (pageNumber: number) => {
      scrollControls?.scrollToPage({
        pageNumber: Math.min(Math.max(pageNumber, 1), totalPages),
        behavior: "smooth",
        alignX: 50,
        alignY: 0,
      });
    },
    [scrollControls, totalPages]
  );

  const commitPageInput = useCallback(() => {
    const parsedPage = Number.parseInt(pageInput, 10);

    if (!Number.isFinite(parsedPage)) {
      setPageInput(String(currentPage));
      return;
    }

    scrollToPage(parsedPage);
  }, [currentPage, pageInput, scrollToPage]);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    capturePdfDownloaded({ fileName, fileUrl });
    try {
      await downloadPdfFile({ fileUrl, fileName });
    } finally {
      setIsDownloading(false);
    }
  }, [fileName, fileUrl, isDownloading]);

  const handleViewMarkdown = useCallback(() => {
    setIsMarkdownMenuOpen(false);
    onViewMarkdown();
  }, [onViewMarkdown]);

  const handleCopyMarkdown = useCallback(() => {
    setIsMarkdownMenuOpen(false);
    onCopyMarkdown();
  }, [onCopyMarkdown]);

  const isMarkdownBusy = paperStatus === "loading";
  const isPdfMode = viewMode === "pdf";

  return (
      <div className="flex h-12 shrink-0 items-center justify-between gap-1 border-b border-black/10 bg-white px-2 dark:border-white/10 dark:bg-gray-800 sm:gap-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Download PDF"
            title="Download PDF"
            disabled={isDownloading}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          {enableQuestionMarkdown ? (
            <div ref={markdownMenuRef} className="group/markdown relative">
              <button
                type="button"
                onClick={() => {
                  setIsMarkdownTooltipVisible(false);
                  setIsMarkdownMenuOpen((currentValue) => !currentValue);
                }}
                className={TOOLBAR_BUTTON_CLASS}
                aria-label="AI Markdown actions"
                aria-describedby={
                  isMarkdownTooltipVisible ? markdownTooltipId : undefined
                }
                aria-expanded={isMarkdownMenuOpen}
              >
                {isMarkdownBusy ? (
                  <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
                ) : copyStatus === "copied" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              {!isMarkdownMenuOpen && isMarkdownTooltipVisible ? (
                <div
                  id={markdownTooltipId}
                  role="tooltip"
                  className="absolute left-0 top-10 z-20 hidden w-64 translate-y-0 border border-black/10 bg-white/95 p-3 pr-9 text-left opacity-100 shadow-xl backdrop-blur dark:border-white/10 dark:bg-gray-900/95 sm:block"
                >
                  <button
                    type="button"
                    onClick={() => setIsMarkdownTooltipVisible(false)}
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-black/5 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200 dark:focus-visible:ring-gray-500"
                    aria-label="Dismiss Markdown tip"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-sm bg-[#253EE0]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#253EE0] dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7]">
                      New
                    </span>
                    <span className="text-xs font-semibold text-gray-950 dark:text-gray-50">
                      Question Markdown
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">
                    Turn this paper into a clean question list, then view it or copy it.
                  </p>
                </div>
              ) : null}
              {isMarkdownMenuOpen ? (
                <div className="absolute left-0 top-10 z-30 w-52 overflow-hidden border border-black/10 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={handleViewMarkdown}
                    className={MARKDOWN_ACTION_BUTTON_CLASS}
                  >
                    <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>View as Markdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className={MARKDOWN_ACTION_BUTTON_CLASS}
                    disabled={isMarkdownBusy || copyStatus === "copying"}
                  >
                    {copyStatus === "copied" ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Clipboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {copyStatus === "copied" ? "Copied Markdown" : "Copy as Markdown"}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {!isPdfMode ? (
            <button
              type="button"
              onClick={onShowPdf}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded px-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-gray-500"
              aria-label="View PDF"
              title="View PDF"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>PDF</span>
            </button>
          ) : (
            <>
          <button
            type="button"
            onClick={() => scrollToPage(currentPage - 1)}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Previous page"
            title="Previous page"
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onFocus={() => setPageInput(String(currentPage))}
            onBlur={commitPageInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitPageInput();
              }
            }}
            className={PAGE_INPUT_CLASS}
            aria-label="Current page"
          />
          <span className="whitespace-nowrap text-sm tabular-nums text-gray-600 dark:text-gray-300">
            / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => scrollToPage(currentPage + 1)}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Next page"
            title="Next page"
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {isPdfMode ? (
            <>
          <button
            type="button"
            onClick={() => zoomControls?.zoomOut()}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!zoomControls || zoomState.currentZoomLevel <= MIN_ZOOM}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoomControls?.requestZoom(ZoomMode.FitWidth)}
            className="hidden h-8 min-w-14 shrink-0 rounded px-2 text-center text-sm tabular-nums text-gray-600 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus-visible:ring-gray-500 sm:inline-flex sm:items-center sm:justify-center"
            aria-label="Fit width"
            title="Fit width"
            disabled={!zoomControls}
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            onClick={() => zoomControls?.zoomIn()}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!zoomControls || zoomState.currentZoomLevel >= MAX_ZOOM}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
            </>
          ) : (
            null
          )}
          <button
            type="button"
            onClick={onTogglePdfDarkMode}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label={
              isPdfDarkMode
                ? "Render page in light mode"
                : "Render page in dark mode"
            }
            aria-pressed={isPdfDarkMode}
            title={
              isPdfDarkMode
                ? "Render page in light mode"
                : "Render page in dark mode"
            }
          >
            {isPdfDarkMode ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleFullScreen}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
  );
}

function PdfVoiceBridge({
  documentId,
  fileName,
  fileUrl,
}: {
  documentId: string;
  fileName: string;
  fileUrl: string;
}) {
  const viewerIdRef = useRef(`pdf_${Math.random().toString(36).slice(2, 10)}`);
  const { provides: scrollControls, state: scrollState } = useScroll(documentId);
  const currentPage = Math.max(scrollState.currentPage || 1, 1);
  const totalPages = Math.max(scrollState.totalPages || 1, 1);

  const navigateToPage = useCallback(
    (pageNumber: number) => {
      scrollControls?.scrollToPage({
        pageNumber: Math.min(Math.max(Math.round(pageNumber), 1), totalPages),
        behavior: "smooth",
        alignX: 50,
        alignY: 0,
      });
    },
    [scrollControls, totalPages],
  );

  useEffect(() => {
    setActivePdfSnapshot({
      currentPage,
      fileName,
      fileUrl,
      navigateToPage,
      title: document.title,
      totalPages,
      viewerId: viewerIdRef.current,
    });
  }, [currentPage, fileName, fileUrl, navigateToPage, totalPages]);

  useEffect(
    () => () => {
      clearActivePdfSnapshot(viewerIdRef.current);
    },
    [],
  );

  return null;
}

function LoadedDocumentSurface({
  documentId,
  enableQuestionMarkdown,
  fileUrl,
  fileName,
  isFullScreen,
  isPdfDarkMode,
  onTogglePdfDarkMode,
  onToggleFullScreen,
}: {
  documentId: string;
  enableQuestionMarkdown: boolean;
  fileUrl: string;
  fileName: string;
  isFullScreen: boolean;
  isPdfDarkMode: boolean;
  onTogglePdfDarkMode: () => void;
  onToggleFullScreen: () => void;
}) {
  const [viewMode, setViewMode] = useState<PaperViewMode>("pdf");
  const [paper, setPaper] = useState<PdfPaperDocument | null>(null);
  const [paperMarkdown, setPaperMarkdown] = useState("");
  const [paperStatus, setPaperStatus] = useState<PaperStatus>("idle");
  const [paperError, setPaperError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const paperAbortRef = useRef<AbortController | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setViewMode("pdf");
    setPaper(null);
    setPaperMarkdown("");
    setPaperStatus("idle");
    setPaperError(null);
    setCopyStatus("idle");
    paperAbortRef.current?.abort();
    paperAbortRef.current = null;
  }, [fileName, fileUrl]);

  useEffect(
    () => () => {
      paperAbortRef.current?.abort();
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    },
    [],
  );

  const markCopied = useCallback(() => {
    setCopyStatus("copied");
    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyResetTimerRef.current = null;
    }, 1800);
  }, []);

  const copyMarkdownText = useCallback(
    async (markdown: string) => {
      if (!markdown.trim()) {
        return;
      }

      setCopyStatus("copying");
      try {
        await copyTextToClipboard(markdown);
        markCopied();
      } catch (error) {
        setCopyStatus("idle");
        setPaperError(
          error instanceof Error ? error.message : "Failed to copy Markdown.",
        );
        setPaperStatus("error");
        setViewMode("paper");
      }
    },
    [markCopied],
  );

  const loadPaper = useCallback(
    async ({
      copyAfter = false,
      force = false,
      showPaper = false,
    }: {
      copyAfter?: boolean;
      force?: boolean;
      showPaper?: boolean;
    } = {}) => {
      if (!enableQuestionMarkdown) {
        return;
      }

      if (showPaper) {
        setViewMode("paper");
      }

      if (!force && paperStatus === "loading") {
        return;
      }

      if (!force && paperStatus === "ready" && paperMarkdown.trim()) {
        if (copyAfter) {
          await copyMarkdownText(paperMarkdown);
        }
        return;
      }

      const controller = new AbortController();
      paperAbortRef.current?.abort();
      paperAbortRef.current = controller;

      setPaperError(null);
      if (force) {
        setPaper(null);
        setPaperMarkdown("");
      }
      setPaperStatus("loading");

      try {
        const response = await loadPdfPaper({
          fileName,
          fileUrl,
          onPartial: (partialPaper) => {
            if (controller.signal.aborted) {
              return;
            }

            setPaper(partialPaper);
          },
          signal: controller.signal,
        });

        setPaper(response.paper);
        setPaperMarkdown(response.markdown);
        setPaperStatus("ready");

        if (copyAfter) {
          await copyMarkdownText(response.markdown);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPaperStatus("error");
        setPaperError(
          error instanceof Error
            ? error.message
            : "Failed to convert this PDF to Markdown.",
        );

        if (copyAfter) {
          setViewMode("paper");
        }
      } finally {
        if (paperAbortRef.current === controller) {
          paperAbortRef.current = null;
        }
      }
    },
    [
      copyMarkdownText,
      enableQuestionMarkdown,
      fileName,
      fileUrl,
      paperMarkdown,
      paperStatus,
    ],
  );

  const handleViewMarkdown = useCallback(() => {
    void loadPaper({ showPaper: true });
  }, [loadPaper]);

  const handleCopyMarkdown = useCallback(() => {
    void loadPaper({ copyAfter: true });
  }, [loadPaper]);

  const handleRetryMarkdown = useCallback(() => {
    void loadPaper({ force: true, showPaper: true });
  }, [loadPaper]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PdfVoiceBridge
        documentId={documentId}
        fileName={fileName}
        fileUrl={fileUrl}
      />
      <ViewerToolbar
        documentId={documentId}
        enableQuestionMarkdown={enableQuestionMarkdown}
        fileUrl={fileUrl}
        fileName={fileName}
        isFullScreen={isFullScreen}
        isPdfDarkMode={isPdfDarkMode}
        viewMode={viewMode}
        paperStatus={paperStatus}
        copyStatus={copyStatus}
        onCopyMarkdown={handleCopyMarkdown}
        onShowPdf={() => setViewMode("pdf")}
        onTogglePdfDarkMode={onTogglePdfDarkMode}
        onToggleFullScreen={onToggleFullScreen}
        onViewMarkdown={handleViewMarkdown}
      />
      {viewMode === "paper" ? (
        <AiPaperView
          errorMessage={paperError}
          isDarkMode={isPdfDarkMode}
          paper={paper}
          status={paperStatus}
          onRetry={handleRetryMarkdown}
        />
      ) : (
        <Viewport
          documentId={documentId}
          className="min-h-0 flex-1 overflow-auto bg-gray-100 dark:bg-gray-950"
          style={{ overflowY: "scroll", scrollbarGutter: "stable" }}
        >
          <Scroller
            documentId={documentId}
            className="py-3 sm:py-4"
            renderPage={({ pageIndex, rotatedHeight, rotatedWidth }) => (
              <div
                className={`relative overflow-hidden shadow-[0_3px_18px_-10px_rgba(0,0,0,0.45)] ${
                  isPdfDarkMode ? "bg-black" : "bg-white"
                }`}
                style={{
                  width: rotatedWidth,
                  height: rotatedHeight,
                }}
              >
                <PageRenderLayer
                  documentId={documentId}
                  isPdfDarkMode={isPdfDarkMode}
                  pageIndex={pageIndex}
                />
              </div>
            )}
          />
        </Viewport>
      )}
    </div>
  );
}

function DocumentViewport({
  documentId,
  enableQuestionMarkdown,
  fileUrl,
  fileName,
  isFullScreen,
  isPdfDarkMode,
  onTogglePdfDarkMode,
  onToggleFullScreen,
}: {
  documentId: string;
  enableQuestionMarkdown: boolean;
  fileUrl: string;
  fileName: string;
  isFullScreen: boolean;
  isPdfDarkMode: boolean;
  onTogglePdfDarkMode: () => void;
  onToggleFullScreen: () => void;
}) {
  return (
    <DocumentContent documentId={documentId}>
      {({ documentState, isError, isLoaded, isLoading }) => {
        if (isError) {
          return <ErrorState fileUrl={fileUrl} />;
        }

        if (isLoading || !isLoaded) {
          const progress =
            typeof documentState.loadingProgress === "number"
              ? ` ${Math.round(documentState.loadingProgress)}%`
              : "";

          return <LoadingState label={`Loading PDF${progress}`} />;
        }

        return (
          <LoadedDocumentSurface
            documentId={documentId}
            enableQuestionMarkdown={enableQuestionMarkdown}
            fileUrl={fileUrl}
            fileName={fileName}
            isFullScreen={isFullScreen}
            isPdfDarkMode={isPdfDarkMode}
            onTogglePdfDarkMode={onTogglePdfDarkMode}
            onToggleFullScreen={onToggleFullScreen}
          />
        );
      }}
    </DocumentContent>
  );
}

export default function PDFViewer({
  enableQuestionMarkdown = false,
  fileUrl,
  fileName,
}: {
  enableQuestionMarkdown?: boolean;
  fileUrl: string;
  fileName?: string;
}) {
  const downloadFileName = useMemo(
    () => fileName ?? getFallbackPdfFileName(fileUrl),
    [fileName, fileUrl]
  );
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPdfDarkMode, setIsPdfDarkMode] = useState(false);
  const [bufferState, setBufferState] = useState<PdfBufferState>({
    status: "loading",
    progress: null,
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const [showSlowLoadFallback, setShowSlowLoadFallback] = useState(false);
  const engineState = usePreloadedPdfiumEngine(retryNonce);

  const retryViewerLoad = useCallback(() => {
    setShowSlowLoadFallback(false);
    setRetryNonce((currentValue) => currentValue + 1);
  }, []);

  useEffect(() => {
    let isActive = true;
    setShowSlowLoadFallback(false);
    setBufferState({ status: "loading", progress: null });

    if (retryNonce > 0) {
      invalidatePdfBuffer(fileUrl);
    }

    const { promise, unsubscribe } = loadPdfBuffer(fileUrl, (progress) => {
      if (!isActive) return;
      setBufferState({ status: "loading", progress });
    });

    promise
      .then((buffer) => {
        if (!isActive) return;
        setBufferState({ status: "loaded", buffer });
      })
      .catch((loadError) => {
        if (!isActive) return;
        setBufferState({
          status: "error",
          message:
            loadError instanceof Error
              ? loadError.message
              : "Failed to download PDF",
        });
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [fileUrl, retryNonce]);

  useEffect(() => {
    if (engineState.status !== "loading" && bufferState.status !== "loading") {
      setShowSlowLoadFallback(false);
      return;
    }

    const slowLoadTimer = window.setTimeout(() => {
      setShowSlowLoadFallback(true);
    }, SLOW_LOAD_NOTICE_MS);

    return () => window.clearTimeout(slowLoadTimer);
  }, [bufferState.status, engineState.status, retryNonce]);

  const plugins = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [
          {
            buffer:
              bufferState.status === "loaded"
                ? bufferState.buffer
                : new ArrayBuffer(0),
            name: downloadFileName,
            autoActivate: true,
          },
        ],
      }),
      createPluginRegistration(ViewportPluginPackage, {
        viewportGap: 0,
        scrollEndDelay: 80,
      }),
      createPluginRegistration(ScrollPluginPackage, {
        defaultStrategy: ScrollStrategy.Vertical,
        defaultPageGap: 16,
        defaultBufferSize: 1,
      }),
      createPluginRegistration(RenderPluginPackage, {
        withForms: false,
        withAnnotations: false,
      }),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: ZoomMode.FitWidth,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomStep: 0.1,
      }),
    ],
    [bufferState, downloadFileName]
  );

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((currentValue) => !currentValue);
  }, []);

  const togglePdfDarkMode = useCallback(() => {
    setIsPdfDarkMode((currentValue) => !currentValue);
  }, []);

  if (engineState.status === "error") {
    return (
      <ErrorState
        fileUrl={fileUrl}
        message="The fast PDF engine could not start."
        onRetry={retryViewerLoad}
      />
    );
  }

  if (engineState.status === "loading") {
    return (
      <LoadingState
        label="Loading PDF engine"
        fileUrl={fileUrl}
        showFallback={showSlowLoadFallback}
        onRetry={retryViewerLoad}
      />
    );
  }

  if (bufferState.status === "error") {
    return (
      <ErrorState
        fileUrl={fileUrl}
        message={bufferState.message}
        onRetry={retryViewerLoad}
      />
    );
  }

  if (bufferState.status === "loading") {
    const progress =
      typeof bufferState.progress === "number"
        ? ` ${Math.round(bufferState.progress)}%`
        : "";

    return (
      <LoadingState
        label={`Downloading PDF${progress}`}
        fileUrl={fileUrl}
        progress={bufferState.progress}
        showFallback={showSlowLoadFallback}
        onRetry={retryViewerLoad}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden ${
        isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""
      }`}
    >
      <EmbedPDF
        key={fileUrl}
        engine={engineState.engine}
        plugins={plugins}
        autoMountDomElements={false}
      >
        {({ activeDocumentId }) =>
          activeDocumentId ? (
            <DocumentViewport
              documentId={activeDocumentId}
              enableQuestionMarkdown={enableQuestionMarkdown}
              fileUrl={fileUrl}
              fileName={downloadFileName}
              isFullScreen={isFullScreen}
              isPdfDarkMode={isPdfDarkMode}
              onTogglePdfDarkMode={togglePdfDarkMode}
              onToggleFullScreen={toggleFullScreen}
            />
          ) : (
            <LoadingState label="Opening PDF" />
          )
        }
      </EmbedPDF>
    </div>
  );
}
