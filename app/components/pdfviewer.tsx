"use client";

import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF, useDocumentState } from "@embedpdf/core/react";
import Image from "next/image";
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
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Streamdown,
  type Components as StreamdownComponents,
  type PluginConfig as StreamdownPluginConfig,
} from "streamdown";
import { LazyPastPaperPageEditor } from "@/app/components/moderation/lazy-editors";
import type { PdfPaperDocument } from "@/lib/ai/pdf-markdown";
import type { PdfPageEdits } from "@/lib/pdf/page-edits";
import { downloadPdfFile } from "@/lib/downloads/browser-downloads";
import { getFallbackPdfFileName } from "@/lib/downloads/resource-names";
import { invalidatePdfBuffer, loadPdfBuffer } from "@/lib/pdf/pdf-buffer-cache";
import { usePreloadedPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
import {
  applyPdfPageEditsToBuffer,
  normalizePdfPageEdits,
  serializePdfPageEdits,
} from "@/lib/pdf/page-edits";
import { capturePdfDownloaded, getPostHogSessionId } from "@/lib/posthog/client";
import {
  clearActivePdfSnapshot,
  setActivePdfSnapshot,
} from "@/app/components/voice/pdf-voice-context";
import type {
  PdfMarkdownCacheMetadata,
  PdfMarkdownFeedbackVote,
} from "@/lib/ai/pdf-markdown-cache-types";

const TOOLBAR_BUTTON_CLASS =
  "inline-flex size-8 shrink-0 items-center justify-center rounded text-gray-600 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus-visible:ring-gray-500";
const PAGE_INPUT_CLASS =
  "h-8 w-12 rounded border border-gray-300 bg-white px-1 text-center text-sm tabular-nums text-gray-700 outline-none transition focus:border-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 sm:w-14";
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const SLOW_LOAD_NOTICE_MS = 3500;
const PDF_DARK_MODE_FILTER =
  "invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.95)";
const PDF_MARKDOWN_ENDPOINT = "/api/pdf/markdown";
const PDF_MARKDOWN_FEEDBACK_ENDPOINT = "/api/pdf/markdown/feedback";
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
  cache?: PdfMarkdownCacheMetadata;
  paper: PdfPaperDocument;
  markdown: string;
  model?: string;
};

type PdfPaperStreamEvent =
  | { type: "partial"; paper?: unknown }
  | {
      type: "done";
      cache?: PdfMarkdownCacheMetadata;
      paper: PdfPaperDocument;
      markdown: string;
      model?: string;
    }
  | { type: "error"; error?: string };

type PdfBufferState =
  | { status: "loading"; progress: number | null }
  | { status: "loaded"; buffer: ArrayBuffer }
  | { status: "error"; message: string };

type PdfViewerModeration = {
  pageEdits: PdfPageEdits | null;
  paperId: string;
};

type PdfViewerProps = {
  enableQuestionMarkdown?: boolean;
  fileName?: string;
  fileUrl: string;
  moderation?: PdfViewerModeration | null;
  pageEdits?: PdfPageEdits | null;
};

type SavedPageEditsState = {
  sourceKey: string;
  value: PdfPageEdits | null;
};

type PdfBufferLifecycleState = {
  bufferState: PdfBufferState;
  bufferVersion: number;
  retryNonce: number;
  showSlowLoadFallback: boolean;
};

type PdfBufferLifecycleAction =
  | { type: "retry" }
  | { type: "loadingStarted" }
  | { type: "loadingProgress"; progress: number | null }
  | { type: "loaded"; buffer: ArrayBuffer }
  | { type: "failed"; message: string }
  | { type: "showSlowLoadFallback" }
  | { type: "hideSlowLoadFallback" };

type PaperSessionState = {
  viewMode: PaperViewMode;
  paper: PdfPaperDocument | null;
  paperMarkdown: string;
  paperCache: PdfMarkdownCacheMetadata | null;
  paperStatus: PaperStatus;
  paperError: string | null;
  feedbackError: string | null;
  pendingFeedbackVote: PdfMarkdownFeedbackVote | null;
  copyStatus: CopyStatus;
};

type PaperSessionAction =
  | { type: "resetDocument" }
  | { type: "showPaper" }
  | { type: "showPdf" }
  | { type: "copying" }
  | { type: "copied" }
  | { type: "copyIdle" }
  | { type: "copyFailed"; message: string }
  | { type: "loadStarted"; force: boolean }
  | { type: "loadPartial"; paper: PdfPaperDocument }
  | {
      type: "loadSucceeded";
      paper: PdfPaperDocument;
      markdown: string;
      cache: PdfMarkdownCacheMetadata | null;
    }
  | { type: "loadFailed"; message: string; showPaper: boolean }
  | { type: "feedbackStarted"; vote: PdfMarkdownFeedbackVote }
  | { type: "feedbackSucceeded"; cache: PdfMarkdownCacheMetadata }
  | { type: "feedbackFailed"; message: string };

const INITIAL_PAPER_SESSION_STATE: PaperSessionState = {
  viewMode: "pdf",
  paper: null,
  paperMarkdown: "",
  paperCache: null,
  paperStatus: "idle",
  paperError: null,
  feedbackError: null,
  pendingFeedbackVote: null,
  copyStatus: "idle",
};

const INITIAL_PDF_BUFFER_LIFECYCLE_STATE: PdfBufferLifecycleState = {
  bufferState: {
    status: "loading",
    progress: null,
  },
  bufferVersion: 0,
  retryNonce: 0,
  showSlowLoadFallback: false,
};

function pdfBufferLifecycleReducer(
  state: PdfBufferLifecycleState,
  action: PdfBufferLifecycleAction,
): PdfBufferLifecycleState {
  switch (action.type) {
    case "retry":
      return {
        ...state,
        retryNonce: state.retryNonce + 1,
        showSlowLoadFallback: false,
      };
    case "loadingStarted":
      return {
        ...state,
        bufferState: { status: "loading", progress: null },
        showSlowLoadFallback: false,
      };
    case "loadingProgress":
      return {
        ...state,
        bufferState: { status: "loading", progress: action.progress },
      };
    case "loaded":
      return {
        ...state,
        bufferState: { status: "loaded", buffer: action.buffer },
        bufferVersion: state.bufferVersion + 1,
      };
    case "failed":
      return {
        ...state,
        bufferState: {
          status: "error",
          message: action.message,
        },
      };
    case "showSlowLoadFallback":
      return state.showSlowLoadFallback
        ? state
        : { ...state, showSlowLoadFallback: true };
    case "hideSlowLoadFallback":
      return state.showSlowLoadFallback
        ? { ...state, showSlowLoadFallback: false }
        : state;
    default:
      return state;
  }
}

function isPaperSessionReset(state: PaperSessionState) {
  return (
    state.viewMode === "pdf" &&
    state.paper === null &&
    state.paperMarkdown === "" &&
    state.paperCache === null &&
    state.paperStatus === "idle" &&
    state.paperError === null &&
    state.feedbackError === null &&
    state.pendingFeedbackVote === null &&
    state.copyStatus === "idle"
  );
}

function resetPaperSession(state: PaperSessionState) {
  return isPaperSessionReset(state) ? state : INITIAL_PAPER_SESSION_STATE;
}

function paperSessionReducer(
  state: PaperSessionState,
  action: PaperSessionAction,
): PaperSessionState {
  switch (action.type) {
    case "resetDocument":
      return resetPaperSession(state);
    case "showPaper":
      return state.viewMode === "paper" ? state : { ...state, viewMode: "paper" };
    case "showPdf":
      return state.viewMode === "pdf" ? state : { ...state, viewMode: "pdf" };
    case "copying":
      return { ...state, copyStatus: "copying" };
    case "copied":
      return { ...state, copyStatus: "copied" };
    case "copyIdle":
      return state.copyStatus === "idle" ? state : { ...state, copyStatus: "idle" };
    case "copyFailed":
      return {
        ...state,
        copyStatus: "idle",
        paperError: action.message,
        paperStatus: "error",
        viewMode: "paper",
      };
    case "loadStarted":
      return {
        ...state,
        paper: action.force ? null : state.paper,
        paperMarkdown: action.force ? "" : state.paperMarkdown,
        paperCache: action.force ? null : state.paperCache,
        paperStatus: "loading",
        paperError: null,
        feedbackError: null,
      };
    case "loadPartial":
      return { ...state, paper: action.paper };
    case "loadSucceeded":
      return {
        ...state,
        paper: action.paper,
        paperMarkdown: action.markdown,
        paperCache: action.cache,
        paperStatus: "ready",
      };
    case "loadFailed":
      return {
        ...state,
        paperStatus: "error",
        paperError: action.message,
        viewMode: action.showPaper ? "paper" : state.viewMode,
      };
    case "feedbackStarted":
      return {
        ...state,
        feedbackError: null,
        pendingFeedbackVote: action.vote,
      };
    case "feedbackSucceeded":
      return {
        ...state,
        paperCache: action.cache,
        pendingFeedbackVote: null,
      };
    case "feedbackFailed":
      return {
        ...state,
        feedbackError: action.message,
        pendingFeedbackVote: null,
      };
    default:
      return state;
  }
}

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
  cacheMode?: "default" | "refresh";
  fileName: string;
  fileUrl: string;
  onPartial?: (paper: PdfPaperDocument) => void;
  pageEdits?: PdfPageEdits | null;
  signal: AbortSignal;
}): Promise<PdfPaperResponse> {
  const response = await fetch(PDF_MARKDOWN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cacheMode: input.cacheMode ?? "default",
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      pageEdits: input.pageEdits ?? null,
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
        cache: event.cache,
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

async function submitPdfMarkdownFeedback(input: {
  cache: PdfMarkdownCacheMetadata;
  vote: PdfMarkdownFeedbackVote;
}) {
  if (!input.cache.cacheKey || !input.cache.generationId) {
    throw new Error("This Markdown generation cannot be rated yet.");
  }

  const response = await fetch(PDF_MARKDOWN_FEEDBACK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cacheKey: input.cache.cacheKey,
      contentHash: input.cache.contentHash,
      generationId: input.cache.generationId,
      model: input.cache.model,
      vote: input.vote,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getJsonResponseErrorMessage(response));
  }

  const payload = (await response.json()) as {
    cache?: PdfMarkdownCacheMetadata;
  };

  if (!payload.cache) {
    throw new Error("Feedback was saved, but the updated score was missing.");
  }

  return payload.cache;
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
              className="rounded bg-[#0A0F1C] px-3 py-1.5 font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
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
          className="rounded bg-[#0A0F1C] px-3 py-1.5 font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
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
      <AlertCircle className="size-7 text-red-500" aria-hidden="true" />
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

function getAccuracyCopy(cache: PdfMarkdownCacheMetadata | null) {
  if (!cache || cache.status === "disabled" || cache.status === "skipped") {
    return {
      description:
        "Redis feedback is unavailable for this generation, so verify it against the PDF before relying on it.",
      label: "Not cached",
      tone: "neutral" as const,
    };
  }

  switch (cache.feedback.status) {
    case "community_verified":
      return {
        description:
          "Multiple students marked this extraction as accurate. Still verify formulas and marks against the PDF.",
        label: "Community verified",
        tone: "good" as const,
      };
    case "helpful":
      return {
        description:
          "At least one student marked this extraction as accurate. More feedback improves the cache signal.",
        label: "Positive signal",
        tone: "good" as const,
      };
    case "needs_review":
      return {
        description:
          "Students reported a problem. This cached generation will be bypassed for future requests unless stronger positive feedback exists.",
        label: "Needs review",
        tone: "warning" as const,
      };
    default:
      return {
        description:
          "No student has verified this extraction yet. Check it against the original PDF before trusting it.",
        label: "Unverified",
        tone: "neutral" as const,
      };
  }
}

function AiPaperQualityPanel({
  cache,
  feedbackError,
  isDarkMode,
  pendingVote,
  onFeedback,
}: {
  cache: PdfMarkdownCacheMetadata | null;
  feedbackError: string | null;
  isDarkMode: boolean;
  pendingVote: PdfMarkdownFeedbackVote | null;
  onFeedback: (vote: PdfMarkdownFeedbackVote) => void;
}) {
  const copy = getAccuracyCopy(cache);
  const canVote = Boolean(
    cache?.cacheKey &&
      cache.generationId &&
      ["bypassed", "hit", "stored"].includes(cache.status),
  );
  const selectedVote = cache?.feedback.userVote ?? null;
  const isWarning = copy.tone === "warning";
  const panelClass = isDarkMode
    ? "border-[#D5D5D5]/15 bg-[#D5D5D5]/5"
    : "border-black/10 bg-[#F8FBFC]";
  const badgeClass = isWarning
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
    : copy.tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : "border-current/15 bg-current/5 text-inherit";

  return (
    <section className={`mt-5 border px-4 py-3 text-left ${panelClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {isWarning ? (
            <ShieldAlert
              className="mt-0.5 size-5 shrink-0 text-amber-500"
              aria-hidden="true"
            />
          ) : (
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Is this generation accurate?</p>
              <span className={`border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${badgeClass}`}>
                {copy.label}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 opacity-70">{copy.description}</p>
            {feedbackError ? (
              <p className="mt-2 text-xs font-medium text-red-500">
                {feedbackError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onFeedback("up")}
            disabled={!canVote || pendingVote !== null}
            aria-pressed={selectedVote === "up"}
            className={`inline-flex h-9 items-center gap-1.5 border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-45 ${
              selectedVote === "up"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-current/15 bg-transparent hover:bg-current/10"
            }`}
          >
            <ThumbsUp className="size-4" aria-hidden="true" />
            {pendingVote === "up" ? "Saving" : cache?.feedback.upvotes ?? 0}
          </button>
          <button
            type="button"
            onClick={() => onFeedback("down")}
            disabled={!canVote || pendingVote !== null}
            aria-pressed={selectedVote === "down"}
            className={`inline-flex h-9 items-center gap-1.5 border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-45 ${
              selectedVote === "down"
                ? "border-amber-500 bg-amber-500 text-black"
                : "border-current/15 bg-transparent hover:bg-current/10"
            }`}
          >
            <ThumbsDown className="size-4" aria-hidden="true" />
            {pendingVote === "down" ? "Saving" : cache?.feedback.downvotes ?? 0}
          </button>
        </div>
      </div>
    </section>
  );
}

function AiPaperView({
  cache,
  errorMessage,
  feedbackError,
  isDarkMode,
  paper,
  pendingVote,
  status,
  onFeedback,
  onRetry,
}: {
  cache: PdfMarkdownCacheMetadata | null;
  errorMessage: string | null;
  feedbackError: string | null;
  isDarkMode: boolean;
  paper: PdfPaperDocument | null;
  pendingVote: PdfMarkdownFeedbackVote | null;
  status: PaperStatus;
  onFeedback: (vote: PdfMarkdownFeedbackVote) => void;
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
    ? "bg-[#0A0F1C] text-[#D5D5D5]"
    : "bg-[#C2E6EC] text-black";
  const pageClass = isDarkMode
    ? "border-[#D5D5D5]/15 bg-[#0A0F1C] text-[#D5D5D5] shadow-none"
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
          <AiPaperQualityPanel
            cache={cache}
            feedbackError={feedbackError}
            isDarkMode={isDarkMode}
            pendingVote={pendingVote}
            onFeedback={onFeedback}
          />
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
        dpr: Math.min(window.devicePixelRatio || 1, 2),
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
    <Image
      src={imageUrl}
      alt=""
      fill
      unoptimized
      sizes="100vw"
      className="absolute inset-0 select-none object-fill"
      data-ec-pdf-page-image="true"
      data-ec-pdf-page-index={pageIndex}
      data-ec-pdf-page-number={pageIndex + 1}
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
  const pagesKnown = (scrollState.totalPages ?? 0) > 0;
  const isMultiPage = pagesKnown && totalPages > 1;

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
            <Download className="size-4" aria-hidden="true" />
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
                  <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
                ) : copyStatus === "copied" ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
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
                    className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded text-gray-400 transition hover:bg-black/5 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200 dark:focus-visible:ring-gray-500"
                    aria-label="Dismiss Markdown tip"
                  >
                    <X className="size-3.5" aria-hidden="true" />
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
                    <Eye className="size-4 shrink-0" aria-hidden="true" />
                    <span>View as Markdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className={MARKDOWN_ACTION_BUTTON_CLASS}
                    disabled={isMarkdownBusy || copyStatus === "copying"}
                  >
                    {copyStatus === "copied" ? (
                      <Check className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Clipboard className="size-4 shrink-0" aria-hidden="true" />
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
              <FileText className="size-4" aria-hidden="true" />
              <span>PDF</span>
            </button>
          ) : isMultiPage ? (
            <>
          <button
            type="button"
            onClick={() => scrollToPage(currentPage - 1)}
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Previous page"
            title="Previous page"
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
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
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
            </>
          ) : pagesKnown ? (
            // Single-page document: no paging is possible, so show a static
            // indicator instead of permanently disabled prev/next buttons that
            // look clickable but do nothing.
            <span className="whitespace-nowrap px-1 text-sm tabular-nums text-gray-500 dark:text-gray-400">
              1 page
            </span>
          ) : null}
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
            <Minus className="size-4" aria-hidden="true" />
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
            <Plus className="size-4" aria-hidden="true" />
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
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
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
              <Minimize2 className="size-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-4" aria-hidden="true" />
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
  const viewerId = `pdf_${useId().replaceAll(":", "")}`;
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
      viewerId,
    });
  }, [currentPage, fileName, fileUrl, navigateToPage, totalPages, viewerId]);

  useEffect(
    () => () => {
      clearActivePdfSnapshot(viewerId);
    },
    [viewerId],
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
  moderation,
  onTogglePdfDarkMode,
  onToggleFullScreen,
  onPageEditsSaved,
  pageEdits,
}: {
  documentId: string;
  enableQuestionMarkdown: boolean;
  fileUrl: string;
  fileName: string;
  isFullScreen: boolean;
  isPdfDarkMode: boolean;
  moderation: PdfViewerModeration | null;
  onTogglePdfDarkMode: () => void;
  onToggleFullScreen: () => void;
  onPageEditsSaved: (nextPageEdits: PdfPageEdits | null) => void;
  pageEdits: PdfPageEdits | null;
}) {
  const [paperState, dispatchPaper] = useReducer(
    paperSessionReducer,
    INITIAL_PAPER_SESSION_STATE,
  );
  const {
    viewMode,
    paper,
    paperMarkdown,
    paperCache,
    paperStatus,
    paperError,
    feedbackError,
    pendingFeedbackVote,
    copyStatus,
  } = paperState;
  const paperAbortRef = useRef<AbortController | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const { state: scrollState } = useScroll(documentId);
  const totalPages = Math.max(scrollState.totalPages || 0, 0);
  const pageEditsKey = useMemo(
    () => serializePdfPageEdits(pageEdits),
    [pageEdits],
  );

  useEffect(() => {
    dispatchPaper({ type: "resetDocument" });
    paperAbortRef.current?.abort();
    paperAbortRef.current = null;
  }, [fileName, fileUrl, pageEditsKey]);

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
    dispatchPaper({ type: "copied" });
    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      dispatchPaper({ type: "copyIdle" });
      copyResetTimerRef.current = null;
    }, 1800);
  }, []);

  const copyMarkdownText = useCallback(
    async (markdown: string) => {
      if (!markdown.trim()) {
        return;
      }

      dispatchPaper({ type: "copying" });
      try {
        await copyTextToClipboard(markdown);
        markCopied();
      } catch (error) {
        dispatchPaper({
          type: "copyFailed",
          message:
            error instanceof Error ? error.message : "Failed to copy Markdown.",
        });
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
        dispatchPaper({ type: "showPaper" });
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

      dispatchPaper({ type: "loadStarted", force });

      try {
        const response = await loadPdfPaper({
          cacheMode: force ? "refresh" : "default",
          fileName,
          fileUrl,
          onPartial: (partialPaper) => {
            if (controller.signal.aborted) {
              return;
            }

            dispatchPaper({ type: "loadPartial", paper: partialPaper });
          },
          pageEdits,
          signal: controller.signal,
        });

        dispatchPaper({
          type: "loadSucceeded",
          paper: response.paper,
          markdown: response.markdown,
          cache: response.cache ?? null,
        });

        if (copyAfter) {
          await copyMarkdownText(response.markdown);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        dispatchPaper({
          type: "loadFailed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to convert this PDF to Markdown.",
          showPaper: copyAfter,
        });
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
      pageEdits,
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

  const handleMarkdownFeedback = useCallback(
    (vote: PdfMarkdownFeedbackVote) => {
      if (!paperCache || pendingFeedbackVote) {
        return;
      }

      dispatchPaper({ type: "feedbackStarted", vote });

      void submitPdfMarkdownFeedback({
        cache: paperCache,
        vote,
      })
        .then((updatedCache) => {
          dispatchPaper({ type: "feedbackSucceeded", cache: updatedCache });
        })
        .catch((error) => {
          dispatchPaper({
            type: "feedbackFailed",
            message:
              error instanceof Error
                ? error.message
                : "Failed to save Markdown feedback.",
          });
        });
    },
    [paperCache, pendingFeedbackVote],
  );

  return (
    <div className="flex size-full min-h-0 flex-col">
      <PdfVoiceBridge
        documentId={documentId}
        fileName={fileName}
        fileUrl={fileUrl}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            onShowPdf={() => dispatchPaper({ type: "showPdf" })}
            onTogglePdfDarkMode={onTogglePdfDarkMode}
            onToggleFullScreen={onToggleFullScreen}
            onViewMarkdown={handleViewMarkdown}
          />
          {viewMode === "paper" ? (
            <AiPaperView
              cache={paperCache}
              errorMessage={paperError}
              feedbackError={feedbackError}
              isDarkMode={isPdfDarkMode}
              paper={paper}
              pendingVote={pendingFeedbackVote}
              status={paperStatus}
              onFeedback={handleMarkdownFeedback}
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

        {viewMode === "pdf" && moderation && totalPages > 0 ? (
          <LazyPastPaperPageEditor
            documentId={documentId}
            paperId={moderation.paperId}
            savedPageEdits={pageEdits}
            totalPages={totalPages}
            onSaved={onPageEditsSaved}
          />
        ) : null}
      </div>
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
  moderation,
  onTogglePdfDarkMode,
  onToggleFullScreen,
  onPageEditsSaved,
  pageEdits,
}: {
  documentId: string;
  enableQuestionMarkdown: boolean;
  fileUrl: string;
  fileName: string;
  isFullScreen: boolean;
  isPdfDarkMode: boolean;
  moderation: PdfViewerModeration | null;
  onTogglePdfDarkMode: () => void;
  onToggleFullScreen: () => void;
  onPageEditsSaved: (nextPageEdits: PdfPageEdits | null) => void;
  pageEdits: PdfPageEdits | null;
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
            moderation={moderation}
            onTogglePdfDarkMode={onTogglePdfDarkMode}
            onToggleFullScreen={onToggleFullScreen}
            onPageEditsSaved={onPageEditsSaved}
            pageEdits={pageEdits}
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
  moderation = null,
  pageEdits = null,
}: PdfViewerProps) {
  const downloadFileName = useMemo(
    () => fileName ?? getFallbackPdfFileName(fileUrl),
    [fileName, fileUrl],
  );
  const normalizedInitialPageEdits = useMemo(
    () => normalizePdfPageEdits(pageEdits ?? moderation?.pageEdits ?? null),
    [moderation?.pageEdits, pageEdits],
  );
  const normalizedInitialPageEditsKey = useMemo(
    () => serializePdfPageEdits(normalizedInitialPageEdits),
    [normalizedInitialPageEdits],
  );
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPdfDarkMode, setIsPdfDarkMode] = useState(false);
  const [savedPageEditsState, setSavedPageEditsState] =
    useState<SavedPageEditsState>({
      sourceKey: normalizedInitialPageEditsKey,
      value: normalizedInitialPageEdits,
    });
  const [bufferLifecycleState, dispatchBufferLifecycle] = useReducer(
    pdfBufferLifecycleReducer,
    INITIAL_PDF_BUFFER_LIFECYCLE_STATE,
  );
  const {
    bufferState,
    bufferVersion,
    retryNonce,
    showSlowLoadFallback,
  } = bufferLifecycleState;
  const savedPageEdits =
    savedPageEditsState.sourceKey === normalizedInitialPageEditsKey
      ? savedPageEditsState.value
      : normalizedInitialPageEdits;
  const setSavedPageEdits = (nextPageEdits: PdfPageEdits | null) => {
    const normalizedNextPageEdits = normalizePdfPageEdits(nextPageEdits);
    setSavedPageEditsState({
      sourceKey: serializePdfPageEdits(normalizedNextPageEdits),
      value: normalizedNextPageEdits,
    });
  };
  const deferredPageEdits = useDeferredValue(savedPageEdits);
  const deferredPageEditsKey = useMemo(
    () => serializePdfPageEdits(deferredPageEdits),
    [deferredPageEdits],
  );
  const engineState = usePreloadedPdfiumEngine(retryNonce);

  const retryViewerLoad = useCallback(() => {
    dispatchBufferLifecycle({ type: "retry" });
  }, []);

  useEffect(() => {
    let isActive = true;
    dispatchBufferLifecycle({ type: "loadingStarted" });

    if (retryNonce > 0) {
      invalidatePdfBuffer(fileUrl);
    }

    const { promise, unsubscribe } = loadPdfBuffer(fileUrl, (progress) => {
      if (!isActive) return;
      dispatchBufferLifecycle({ type: "loadingProgress", progress });
    });

    promise
      .then(async (buffer) => {
        if (!isActive) return;

        const nextBuffer = deferredPageEdits
          ? await applyPdfPageEditsToBuffer(buffer, deferredPageEdits)
          : buffer;

        if (!isActive) return;
        dispatchBufferLifecycle({ type: "loaded", buffer: nextBuffer });
      })
      .catch((loadError) => {
        if (!isActive) return;
        dispatchBufferLifecycle({
          type: "failed",
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
  }, [deferredPageEdits, deferredPageEditsKey, fileUrl, retryNonce]);

  useEffect(() => {
    if (engineState.status !== "loading" && bufferState.status !== "loading") {
      dispatchBufferLifecycle({ type: "hideSlowLoadFallback" });
      return;
    }

    const slowLoadTimer = window.setTimeout(() => {
      dispatchBufferLifecycle({ type: "showSlowLoadFallback" });
    }, SLOW_LOAD_NOTICE_MS);

    return () => window.clearTimeout(slowLoadTimer);
  }, [bufferState.status, engineState.status, retryNonce]);

  const activeBuffer = bufferState.status === "loaded" ? bufferState.buffer : null;
  const plugins = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [
          {
            buffer: activeBuffer ?? new ArrayBuffer(0),
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
    [activeBuffer, downloadFileName],
  );
  const documentKey = `${fileUrl}::${bufferVersion}`;

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
        key={documentKey}
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
              moderation={moderation}
              onTogglePdfDarkMode={togglePdfDarkMode}
              onToggleFullScreen={toggleFullScreen}
              onPageEditsSaved={setSavedPageEdits}
              pageEdits={savedPageEdits}
            />
          ) : (
            <LoadingState label="Opening PDF" />
          )
        }
      </EmbedPDF>
    </div>
  );
}
