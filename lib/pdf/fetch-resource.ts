import { foregroundTimeout } from "./foreground-timeout";
import { getPdfDeliveryUrl, getPdfFallbackUrl } from "./delivery-url";

export const PDF_DOWNLOAD_STALL_TIMEOUT_MS = 15000;

class PdfDownloadError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
    this.name = "PdfDownloadError";
  }
}

function validateBytes(buffer: ArrayBuffer, kind: "pdf" | "wasm") {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024));
  const valid = kind === "wasm"
    ? bytes.length >= 8 && bytes[0] === 0 && bytes[1] === 97 && bytes[2] === 115 && bytes[3] === 109
    : new TextDecoder("latin1").decode(bytes).includes("%PDF-");
  if (!valid) throw new PdfDownloadError(`The ${kind === "pdf" ? "PDF" : "PDF engine"} download was empty or invalid.`);
}

export async function fetchPdfResource(
  url: string,
  { kind, signal, onProgress }: {
    kind: "pdf" | "wasm";
    signal?: AbortSignal;
    onProgress?: (progress: number | null) => void;
  },
): Promise<ArrayBuffer> {
  const initialUrl = kind === "pdf" ? getPdfDeliveryUrl(url) : url;
  const fallbackUrl = kind === "pdf"
    ? getPdfFallbackUrl(url) ?? (initialUrl !== url ? url : null)
    : null;
  // One fresh network attempt repairs transient failures and poisoned browser
  // cache entries. Permanent HTTP failures and explicit cancellations stop now.
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    let stopStallTimer = () => {};
    let stalled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const progress = () => {
      stopStallTimer();
      stopStallTimer = foregroundTimeout(() => {
        stalled = true;
        controller.abort();
      }, PDF_DOWNLOAD_STALL_TIMEOUT_MS);
    };
    try {
      onProgress?.(null);
      progress();
      const response = await fetch(attempt > 0 ? fallbackUrl ?? initialUrl : initialUrl, {
        // PDFs can be replaced at the same URL. Respect their freshness headers;
        // force-cache can reuse a stale PDF even after the mirror has updated.
        cache: attempt === 0 ? (kind === "pdf" ? "default" : "force-cache") : "reload",
        mode: "cors",
        signal: controller.signal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new PdfDownloadError(`PDF request failed with ${response.status}`, response.status === 408 || response.status >= 500);
      }
      progress();
      const length = Number(response.headers.get("content-length"));
      const total = Number.isFinite(length) && length > 0 ? length : null;
      let buffer: ArrayBuffer;
      if (response.body) {
        reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.byteLength) continue;
          progress();
          chunks.push(value);
          received += value.byteLength;
          if (total) onProgress?.(Math.min(99, received / total * 100));
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        buffer = bytes.buffer;
      } else {
        buffer = await response.arrayBuffer();
      }
      signal?.throwIfAborted();
      validateBytes(buffer, kind);
      onProgress?.(100);
      return buffer;
    } catch (error) {
      signal?.throwIfAborted();
      const failure = stalled ? new PdfDownloadError("PDF download stalled. Open the original file or retry.") : error;
      const retryable = failure instanceof PdfDownloadError ? failure.retryable : failure instanceof TypeError;
      if (attempt >= 1 || !retryable) throw failure;
    } finally {
      stopStallTimer();
      signal?.removeEventListener("abort", abort);
      void reader?.cancel().catch(() => undefined);
    }
  }
}
