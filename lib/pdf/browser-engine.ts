import { PdfEngine, PdfiumNative, browserImageDataToBlobConverter } from "@embedpdf/engines/pdfium";
import { init } from "@embedpdf/pdfium";

// Named imports let the browser bundler discard unused engine adapters and
// PDFium exports. Keep this module behind load-engine's browser-only import.
export async function createBrowserPdfiumEngine(wasmBinary: ArrayBuffer) {
  const module = await init({ wasmBinary });
  return new PdfEngine(
    new PdfiumNative(module, { fontFallback: { fonts: {} } }),
    { imageConverter: browserImageDataToBlobConverter },
  );
}
