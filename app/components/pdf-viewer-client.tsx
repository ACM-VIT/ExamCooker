"use client";

import { preconnect } from "react-dom";

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
  fileUrl,
  fileName,
}: {
  fileUrl: string;
  fileName?: string;
}) {
  const remoteOrigin = getRemoteOrigin(fileUrl);
  if (remoteOrigin) {
    preconnect(remoteOrigin, { crossOrigin: "anonymous" });
  }

  return <PDFViewer key={fileUrl} fileUrl={fileUrl} fileName={fileName} />;
}
