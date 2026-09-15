"use client";

import { preload } from "react-dom";
import { PDFIUM_WASM_URL } from "@/lib/generated/pdfium-wasm";

// Render-time hints are emitted in the server HTML. An effect would wait for
// hydration before starting these downloads. Match the viewer's CORS fetches
// so it consumes the preload instead of downloading a second copy.
export function preloadPdfResources(fileUrl?: string) {
  preload(PDFIUM_WASM_URL, {
    as: "fetch",
    type: "application/wasm",
    crossOrigin: "anonymous",
  });
  if (fileUrl && !fileUrl.startsWith("blob:") && !fileUrl.startsWith("data:")) {
    preload(fileUrl, { as: "fetch", crossOrigin: "anonymous" });
  }
}
