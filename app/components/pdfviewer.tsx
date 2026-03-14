"use client";

import React, {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faDownload,
  faExpand,
  faMinus,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const buttonClass =
  "p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed";
const inputClass =
  "w-14 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-700 outline-none transition focus:border-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200";
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;
const DEFAULT_SCALE = 1;
const PDF_OPTIONS = {
  disableAutoFetch: true,
  disableRange: true,
  disableStream: true,
};

function clampPage(pageNumber: number, numPages: number) {
  return Math.min(Math.max(pageNumber, 1), Math.max(numPages, 1));
}

function clampScale(scale: number) {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

export default function PDFViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const pageWidth = containerWidth > 0 ? Math.max(containerWidth - 32, 240) : 0;
  const currentPage = numPages ? clampPage(pageNumber, numPages) : pageNumber;
  const canGoPrevious = currentPage > 1;
  const canGoNext = numPages ? currentPage < numPages : false;

  useEffect(() => {
    pageRefs.current = [];
    setNumPages(null);
    setPageNumber(1);
    setPageInput("1");
    setScale(DEFAULT_SCALE);
    setLoadProgress(null);
  }, [fileUrl]);

  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(element.clientWidth);
      setContainerWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth
      );
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages || pageWidth <= 0) return;

    let frameId = 0;

    const syncPageNumberFromScroll = () => {
      frameId = 0;

      const containerRect = container.getBoundingClientRect();
      const containerCenter = container.scrollTop + container.clientHeight / 2;
      let closestPage = 1;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < numPages; index += 1) {
        const pageElement = pageRefs.current[index];
        if (!pageElement) continue;

        const pageRect = pageElement.getBoundingClientRect();
        const pageCenter =
          pageRect.top -
          containerRect.top +
          container.scrollTop +
          pageRect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = index + 1;
        }
      }

      startTransition(() => {
        setPageNumber((currentValue) =>
          currentValue === closestPage ? currentValue : closestPage
        );
      });
    };

    const handleScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(syncPageNumberFromScroll);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [numPages, pageWidth]);

  const documentLoading = useMemo(() => {
    const percentage = loadProgress === null ? null : Math.round(loadProgress);
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        Loading PDF{percentage === null ? "…" : `… ${percentage}%`}
      </div>
    );
  }, [loadProgress]);

  const scrollToPage = (requestedPage: number) => {
    if (!numPages) return;

    const nextPage = clampPage(requestedPage, numPages);
    const pageElement = pageRefs.current[nextPage - 1];

    startTransition(() => {
      setPageNumber(nextPage);
    });

    if (pageElement) {
      pageElement.scrollIntoView({ block: "start" });
    }
  };

  const commitPageNumber = (rawValue: string) => {
    if (!numPages) {
      setPageInput("1");
      return;
    }

    const parsedPage = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsedPage)) {
      setPageInput(String(currentPage));
      return;
    }

    scrollToPage(parsedPage);
  };

  const adjustScale = (delta: number) => {
    startTransition(() => {
      setScale((currentScale) =>
        clampScale(Number((currentScale + delta).toFixed(2)))
      );
    });
  };

  const getDownloadFileName = (url: string) => {
    try {
      const { pathname } = new URL(url);
      const name = pathname.split("/").pop();
      if (!name) return "document.pdf";
      const decoded = decodeURIComponent(name);
      return decoded.toLowerCase().endsWith(".pdf")
        ? decoded
        : `${decoded}.pdf`;
    } catch {
      return "document.pdf";
    }
  };

  const downloadFileName = useMemo(
    () => getDownloadFileName(fileUrl),
    [fileUrl]
  );
  const proxiedFileUrl = useMemo(
    () =>
      `/api/download?url=${encodeURIComponent(
        fileUrl
      )}&filename=${encodeURIComponent(downloadFileName)}`,
    [downloadFileName, fileUrl]
  );

  const handleDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const link = document.createElement("a");
    link.href = proxiedFileUrl;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => setIsDownloading(false), 400);
  };

  return (
    <div
      className={`flex h-full w-full flex-col ${
        isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""
      }`}
    >
      <div className="flex items-center justify-between bg-white p-2 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => scrollToPage(currentPage - 1)}
            disabled={!canGoPrevious}
            className={buttonClass}
            aria-label="Previous page"
            title="Previous page"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <input
            type="number"
            min={1}
            max={numPages ?? undefined}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={(event) => commitPageNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitPageNumber(pageInput);
              }
            }}
            disabled={!numPages}
            className={inputClass}
            aria-label="Current page"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">/</span>
          <span className="min-w-8 text-sm text-gray-600 dark:text-gray-300">
            {numPages ?? "—"}
          </span>
          <button
            onClick={() => scrollToPage(currentPage + 1)}
            disabled={!canGoNext}
            className={buttonClass}
            aria-label="Next page"
            title="Next page"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => adjustScale(-SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
            className={buttonClass}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <FontAwesomeIcon icon={faMinus} />
          </button>
          <span className="min-w-14 text-center text-sm text-gray-600 dark:text-gray-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => adjustScale(SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
            className={buttonClass}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <button
            onClick={() => setIsFullScreen((currentValue) => !currentValue)}
            className={buttonClass}
            aria-label="Toggle fullscreen"
            title="Toggle fullscreen"
          >
            <FontAwesomeIcon icon={faExpand} />
          </button>
          <button
            onClick={handleDownload}
            className={buttonClass}
            aria-label="Download PDF"
            title="Download PDF"
            disabled={isDownloading}
          >
            <FontAwesomeIcon icon={faDownload} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-gray-100 dark:bg-gray-950">
        <Document
          file={proxiedFileUrl}
          options={PDF_OPTIONS}
          onItemClick={({ pageNumber: nextPageNumber }) => {
            if (typeof nextPageNumber === "number") {
              scrollToPage(nextPageNumber);
            }
          }}
          onLoadSuccess={({ numPages: nextNumPages }) => {
            setNumPages(nextNumPages);
            setLoadProgress(100);
            startTransition(() => {
              setPageNumber((currentValue) =>
                clampPage(currentValue, nextNumPages)
              );
            });
          }}
          onLoadProgress={({ loaded, total }) => {
            if (typeof total === "number" && total > 0) {
              setLoadProgress((loaded / total) * 100);
            }
          }}
          onLoadError={() => {
            setLoadProgress(null);
          }}
          loading={documentLoading}
          error={
            <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-red-500">
              Failed to load PDF.
            </div>
          }
          noData={
            <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
              No PDF file specified.
            </div>
          }
          className="flex min-h-full flex-col items-center gap-4 p-4"
        >
          {pageWidth > 0 && numPages
            ? Array.from({ length: numPages }, (_, index) => {
                const renderedPageNumber = index + 1;

                return (
                  <div
                    key={`${renderedPageNumber}-${scale}-${pageWidth}`}
                    ref={(node) => {
                      pageRefs.current[index] = node;
                    }}
                    className="w-full max-w-full"
                  >
                    <Page
                      pageNumber={renderedPageNumber}
                      width={pageWidth}
                      scale={scale}
                      renderAnnotationLayer
                      renderTextLayer
                      loading={
                        <div className="flex h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
                          Loading page…
                        </div>
                      }
                      error={
                        <div className="flex h-[320px] items-center justify-center text-sm text-red-500">
                          Failed to render page.
                        </div>
                      }
                    />
                  </div>
                );
              })
            : null}
        </Document>
      </div>
    </div>
  );
}
