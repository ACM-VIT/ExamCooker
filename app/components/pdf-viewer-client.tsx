"use client";

import { preconnect } from "react-dom";
import { useEffect } from "react";
import dynamic from "next/dynamic";

import type { PdfPageEdits } from "@/lib/pdf/page-edits";
import { preloadPdfBuffer } from "@/lib/pdf/pdf-buffer-cache";
import { preloadPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
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

export default function PDFViewerClient({
  enableQuestionMarkdown = false,
  fileUrl,
  fileName,
  moderation,
  pageEdits,
}: {
  enableQuestionMarkdown?: boolean;
  fileUrl: string;
  fileName?: string;
  moderation?:
    | {
        paperId: string;
        pageEdits: PdfPageEdits | null;
      }
    | null;
  pageEdits?: PdfPageEdits | null;
}) {
  useEffect(() => {
    // Start the two independent inputs while the viewer chunk is downloading.
    // The viewer consumes these same cached promises when it mounts.
    preloadPdfBuffer(fileUrl);
    void preloadPdfiumEngine().catch(() => undefined);
  }, [fileUrl]);

  const remoteOrigin = getRemoteOrigin(fileUrl);
  if (remoteOrigin) {
    preconnect(remoteOrigin, { crossOrigin: "anonymous" });
  }

  return (
    <PDFViewer
      key={fileUrl}
      enableQuestionMarkdown={enableQuestionMarkdown}
      fileUrl={fileUrl}
      fileName={fileName}
      moderation={moderation}
      pageEdits={pageEdits}
    />
  );
}
