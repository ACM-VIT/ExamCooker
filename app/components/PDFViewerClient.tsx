"use client";

import { preconnect, preload } from "react-dom";

import PDFViewer from "./pdfviewer";

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
    preload(fileUrl, { as: "fetch", crossOrigin: "anonymous" });
  }

  return <PDFViewer key={fileUrl} fileUrl={fileUrl} fileName={fileName} />;
}
