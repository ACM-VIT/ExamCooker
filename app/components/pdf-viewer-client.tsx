"use client";

import { preconnect } from "react-dom";

import type { PdfPageEdits } from "@/lib/pdf/page-edits";
import { preloadPdfiumEngine } from "@/lib/pdf/pdfium-engine-cache";
import PDFViewer from "./pdfviewer";

if (typeof window !== "undefined") {
  void preloadPdfiumEngine().catch(() => undefined);
}

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
