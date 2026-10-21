"use client";

import { preconnect, preload } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { PDF_JOURNEY_READY_EVENT } from "@/lib/pdf/open-journey";
import dynamic from "next/dynamic";

import { normalizePdfPageEdits, preloadPdfPageEdits, type PdfPageEdits } from "@/lib/pdf/page-edits";
import { preloadPdfBuffer } from "@/lib/pdf/pdf-buffer-cache";
import { preloadPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
import { preloadPdfResources } from "@/lib/pdf/preload-resources";
import { isPdfPreviewShown, watchPdfPreviewTakeover } from "@/lib/pdf/preview-takeover";
// PDF/WASM and Markdown plugins run in the browser. Including them in the
// Worker SSR bundle exceeds its memory budget even on unrelated routes.
const PDFViewer = dynamic(() => import("./pdfviewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-300" role="status">
      Loading PDF
    </div>
  ),
});

function getRemoteOrigin(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.origin
      : null;
  } catch {
    return null;
  }
}

// A server-rendered image of the first page, shown while the PDF and its
// engine download. The real page replaces it as soon as it paints.
function FirstPagePreview({ src, fileUrl, onUnavailable }: { src: string; fileUrl: string; onUnavailable: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A server-rendered image can fail before hydration attaches onError.
    if (image.current?.complete && image.current.naturalWidth === 0) onUnavailable();
  }, [onUnavailable]);
  return (
    <div
      data-ec-pdf-preview-layer="true"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-white px-3 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
        <span role="status">Loading PDF</span>
        {/* The viewer's own slow-load actions are underneath this layer. */}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto font-semibold text-gray-700 underline-offset-2 hover:underline dark:text-gray-100"
        >
          Open original
        </a>
      </div>
      <div className="p-4">
        <img
          ref={image}
          src={src}
          alt=""
          decoding="async"
          fetchPriority="high"
          data-ec-pdf-preview="true"
          className="h-auto w-full bg-white shadow-sm"
          onError={onUnavailable}
        />
      </div>
    </div>
  );
}

export default function PDFViewerClient({
  enableQuestionMarkdown = false,
  fileUrl,
  fileName,
  moderation,
  pageEdits,
  journeyPath,
  previewUrl,
}: {
  enableQuestionMarkdown?: boolean;
  journeyPath?: string;
  fileUrl: string;
  fileName?: string;
  previewUrl?: string | null;
  moderation?:
    | {
        paperId: string;
        pageEdits: PdfPageEdits | null;
      }
    | null;
  pageEdits?: PdfPageEdits | null;
}) {
  preloadPdfResources(fileUrl);
  if (previewUrl) preload(previewUrl, { as: "image", fetchPriority: "high" });
  const journeyRoot = useRef<HTMLDivElement>(null);
  const viewerRoot = useRef<HTMLDivElement>(null);
  // Once a document's viewer has taken over, a later preview URL for it (for
  // example after a moderator saves page edits) must not cover it again.
  const [settledFile, setSettledFile] = useState<string | null>(null);
  const showPreview = isPdfPreviewShown(previewUrl, fileUrl, settledFile);
  const replacePreview = useCallback(() => setSettledFile(fileUrl), [fileUrl]);

  useEffect(() => {
    const root = viewerRoot.current;
    if (!root || !previewUrl) return;
    return watchPdfPreviewTakeover(root, () => setSettledFile(fileUrl));
  }, [fileUrl, previewUrl]);
  useEffect(() => {
    if (journeyPath) journeyRoot.current?.dispatchEvent(new Event(PDF_JOURNEY_READY_EVENT, { bubbles: true }));
  }, [journeyPath]);

  useEffect(() => {
    // Start the two independent inputs while the viewer chunk is downloading.
    // The viewer consumes these same cached promises when it mounts.
    preloadPdfBuffer(fileUrl);
    void preloadPdfiumEngine().catch(() => undefined);
  }, [fileUrl]);

  useEffect(() => {
    // Download the edit library alongside the PDF, not after all PDF bytes
    // arrive. Unedited documents do not need this additional library.
    if (normalizePdfPageEdits(pageEdits ?? moderation?.pageEdits)) {
      preloadPdfPageEdits();
    }
  }, [pageEdits, moderation?.pageEdits]);

  const remoteOrigin = getRemoteOrigin(fileUrl);
  if (remoteOrigin) {
    preconnect(remoteOrigin, { crossOrigin: "anonymous" });
  }

  const pdfViewer = (
    <PDFViewer
      key={fileUrl}
      enableQuestionMarkdown={enableQuestionMarkdown}
      fileUrl={fileUrl}
      fileName={fileName}
      moderation={moderation}
      pageEdits={pageEdits}
    />
  );
  const viewer = previewUrl ? (
    <div ref={viewerRoot} className="relative h-full w-full">
      {pdfViewer}
      {showPreview ? (
        <FirstPagePreview key={previewUrl} src={previewUrl} fileUrl={fileUrl} onUnavailable={replacePreview} />
      ) : null}
    </div>
  ) : pdfViewer;
  return journeyPath ? (
    <div ref={journeyRoot} className="contents" data-ec-pdf-journey-path={journeyPath}>
      {viewer}
    </div>
  ) : viewer;
}
