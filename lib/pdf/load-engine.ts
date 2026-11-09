import { loadPdfiumWasm, releasePdfiumWasm } from "./pdfium-wasm";
import { foregroundTimeout } from "./foreground-timeout";

export const PDFIUM_ENGINE_LOAD_TIMEOUT_MS = 15000;

export class PdfiumEngineTimeoutError extends Error {
  constructor() {
    super("PDF engine initialization timed out");
    this.name = "PdfiumEngineTimeoutError";
  }
}

export function engineDeadline<T>(promise: Promise<T>, disposeLate?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const cancel = foregroundTimeout(() => {
      expired = true;
      reject(new PdfiumEngineTimeoutError());
    }, PDFIUM_ENGINE_LOAD_TIMEOUT_MS);
    promise.then((value) => {
      cancel();
      if (expired) disposeLate?.(value);
      else resolve(value);
    }, (error) => { cancel(); if (!expired) reject(error); });
  });
}

export async function loadPdfiumEngine() {
  // Preload hooks are imported by SSR components too. Keep the browser-only
  // PDFium imports out of that bundle, including when the viewer uses ssr:false.
  if (typeof window === "undefined") throw new Error("PDF rendering requires a browser");
  try {
    // Download progress has its own idle timeout. A slow but advancing WASM
    // transfer must not consume the engine's separate initialization deadline.
    const [{ createBrowserPdfiumEngine }, wasmBinary] = await Promise.all([
      engineDeadline(import("./browser-engine")),
      loadPdfiumWasm(),
    ]);
    return await engineDeadline(createBrowserPdfiumEngine(wasmBinary),
      (lateEngine) => { void lateEngine.destroy().toPromise().catch(() => undefined); });
  } finally {
    // The bytes are copied into the engine, or the attempt failed. Either way a
    // rebuild reads the HTTP cache, so this module need not hold 1.65 MB.
    releasePdfiumWasm();
  }
}
