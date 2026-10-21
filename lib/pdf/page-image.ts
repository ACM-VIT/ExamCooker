// Only failed blob-image loads take this path. Bound the temporary base64 copy
// so recovery cannot multiply the memory cost of a large rendered page.
export const MAX_INLINE_PDF_IMAGE_BYTES = 8 * 1024 * 1024;

export function readPdfPageImageDataUrl(blob: Blob, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (!blob.type.startsWith("image/") || blob.size === 0 || blob.size > MAX_INLINE_PDF_IMAGE_BYTES) {
    return Promise.reject(new Error("Rendered PDF image exceeds the inline recovery limits"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      cleanup();
      reader.abort();
      reject(signal.reason ?? new DOMException("PDF image recovery cancelled", "AbortError"));
    };
    reader.onload = () => {
      cleanup();
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Rendered PDF image could not be encoded"));
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error("Rendered PDF image could not be read"));
    };
    signal.addEventListener("abort", abort, { once: true });
    reader.readAsDataURL(blob);
  });
}
