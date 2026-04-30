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
  ZoomGestureWrapper,
  ZoomMode,
  ZoomPluginPackage,
  useZoom,
} from "@embedpdf/plugin-zoom/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Moon,
  Minus,
  Plus,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { downloadPdfFile } from "@/lib/downloads/browser-downloads";
import { getFallbackPdfFileName } from "@/lib/downloads/resource-names";
import { invalidatePdfBuffer, loadPdfBuffer } from "@/lib/pdf/pdf-buffer-cache";
import { usePreloadedPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
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

type PdfBufferState =
  | { status: "loading"; progress: number | null }
  | { status: "loaded"; buffer: ArrayBuffer }
  | { status: "error"; message: string };

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
  fileUrl,
  fileName,
  isFullScreen,
  isPdfDarkMode,
  onTogglePdfDarkMode,
  onToggleFullScreen,
}: {
  documentId: string;
  fileUrl: string;
  fileName: string;
  isFullScreen: boolean;
  isPdfDarkMode: boolean;
  onTogglePdfDarkMode: () => void;
  onToggleFullScreen: () => void;
}) {
  const [pageInput, setPageInput] = useState("1");
  const [isDownloading, setIsDownloading] = useState(false);
  const { provides: scrollControls, state: scrollState } = useScroll(documentId);
  const { provides: zoomControls, state: zoomState } = useZoom(documentId);
  const currentPage = scrollState.currentPage || 1;
  const totalPages = Math.max(scrollState.totalPages || 1, 1);
  const zoomPercent = Math.round((zoomState.currentZoomLevel || 1) * 100);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

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
    posthog.capture("pdf_downloaded", { file_name: fileName, file_url: fileUrl });
    try {
      await downloadPdfFile({ fileUrl, fileName });
    } finally {
      setIsDownloading(false);
    }
  }, [fileName, fileUrl, isDownloading]);

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
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
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
        <button
          type="button"
          onClick={onTogglePdfDarkMode}
          className={TOOLBAR_BUTTON_CLASS}
          aria-label={
            isPdfDarkMode
              ? "Render PDF in light mode"
              : "Render PDF in dark mode"
          }
          aria-pressed={isPdfDarkMode}
          title={
            isPdfDarkMode
              ? "Render PDF in light mode"
              : "Render PDF in dark mode"
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

function DocumentViewport({
  documentId,
  fileUrl,
  fileName,
  isFullScreen,
  isPdfDarkMode,
  onTogglePdfDarkMode,
  onToggleFullScreen,
}: {
  documentId: string;
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
          <div className="flex h-full min-h-0 w-full flex-col">
            <PdfVoiceBridge
              documentId={documentId}
              fileName={fileName}
              fileUrl={fileUrl}
            />
            <ViewerToolbar
              documentId={documentId}
              fileUrl={fileUrl}
              fileName={fileName}
              isFullScreen={isFullScreen}
              isPdfDarkMode={isPdfDarkMode}
              onTogglePdfDarkMode={onTogglePdfDarkMode}
              onToggleFullScreen={onToggleFullScreen}
            />
            <Viewport
              documentId={documentId}
              className="min-h-0 flex-1 overflow-auto bg-gray-100 dark:bg-gray-950"
              style={{ scrollbarGutter: "stable" }}
            >
              <ZoomGestureWrapper documentId={documentId} className="min-h-full">
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
              </ZoomGestureWrapper>
            </Viewport>
          </div>
        );
      }}
    </DocumentContent>
  );
}

export default function PDFViewer({
  fileUrl,
  fileName,
}: {
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
