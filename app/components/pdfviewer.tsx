"use client";

import { PDFViewer as EmbedPDFViewer } from "@embedpdf/react-pdf-viewer";

export default function PDFViewer({ fileUrl }: { fileUrl: string }) {
  return (
    <EmbedPDFViewer
      key={fileUrl}
      config={{
        src: fileUrl,
        theme: { preference: "system" },
      }}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
      onReady={(registry) => {
        console.log("PDF viewer ready!", registry);
      }}
    />
  );
}
