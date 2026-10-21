import { PDFIUM_WASM_URL } from "../generated/pdfium-wasm";
import { fetchPdfResource } from "./fetch-resource";

// One download of the engine per page, shared by the course-page prefetch,
// card warm-up, preload hint and viewer. Separate requests for the same URL
// are not merged by the browser: a second one re-downloads 1.65 MB.
let download: Promise<ArrayBuffer> | null = null;

export function loadPdfiumWasm() {
  download ??= fetchPdfResource(PDFIUM_WASM_URL, { kind: "wasm" }).catch((error) => {
    download = null;
    throw error;
  });
  return download;
}

export function isPdfiumWasmRequested() {
  return download !== null;
}

/** Drop the bytes once the engine is built; a later rebuild reads the HTTP cache. */
export function releasePdfiumWasm() {
  download = null;
}
