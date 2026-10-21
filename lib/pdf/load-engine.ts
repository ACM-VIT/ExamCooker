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

export async function loadPdfiumEngine(signal: AbortSignal) {
  // Preload hooks are imported by SSR components too. Keep the browser-only
  // PDFium imports out of that bundle, including when the viewer uses ssr:false.
  if (typeof window !== "undefined") {
    // Download progress has its own idle timeout. A slow but advancing WASM
    // transfer must not consume the engine's separate initialization deadline.
    const [{ createBrowserPdfiumEngine }, wasmBinary] = await Promise.all([
      engineDeadline(import("./browser-engine")),
      loadPdfiumWasm(),
    ]);
    signal.throwIfAborted();
    const engine = await engineDeadline(createBrowserPdfiumEngine(wasmBinary),
      (lateEngine) => { void lateEngine.destroy().toPromise().catch(() => undefined); });
    releasePdfiumWasm();
    return engine;
  }
  throw new Error("PDF rendering requires a browser");
}
