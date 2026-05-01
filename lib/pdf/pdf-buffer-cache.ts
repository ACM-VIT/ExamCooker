type ProgressListener = (progress: number | null) => void;

type PdfBufferCacheEntry = {
  promise: Promise<ArrayBuffer>;
  listeners: Set<ProgressListener>;
  abort?: () => void;
  buffer?: ArrayBuffer;
};

const MAX_CACHE_ENTRIES = 8;
const PDF_DOWNLOAD_STALL_TIMEOUT_MS = 15000;
const pdfBufferCache = new Map<string, PdfBufferCacheEntry>();

function trimCache() {
  while (pdfBufferCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = pdfBufferCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    pdfBufferCache.delete(oldestKey);
  }
}

function notify(entry: PdfBufferCacheEntry, progress: number | null) {
  for (const listener of entry.listeners) {
    listener(progress);
  }
}

function createPdfBufferEntry(fileUrl: string): PdfBufferCacheEntry {
  const entry: PdfBufferCacheEntry = {
    listeners: new Set(),
    promise: Promise.resolve(new ArrayBuffer(0)),
  };

  entry.promise = (async () => {
    const controller = new AbortController();
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    entry.abort = () => controller.abort();

    const refreshStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
      }

      stallTimer = setTimeout(() => {
        controller.abort();
      }, PDF_DOWNLOAD_STALL_TIMEOUT_MS);
    };

    try {
      refreshStallTimer();

      const response = await fetch(fileUrl, {
        cache: "force-cache",
        mode: "cors",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`PDF request failed with ${response.status}`);
      }

      const contentLength = Number(response.headers.get("content-length"));
      const totalBytes =
        Number.isFinite(contentLength) && contentLength > 0
          ? contentLength
          : null;

      if (!response.body) {
        const buffer = await response.arrayBuffer();
        entry.buffer = buffer;
        notify(entry, 100);
        return buffer;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        refreshStallTimer();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        receivedBytes += value.byteLength;

        if (totalBytes) {
          notify(entry, Math.min(99, (receivedBytes / totalBytes) * 100));
        }
      }

      const bytes = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }

      entry.buffer = bytes.buffer;
      notify(entry, 100);
      return entry.buffer;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("PDF download stalled. Open the original file or retry.");
      }

      throw error;
    } finally {
      if (stallTimer) {
        clearTimeout(stallTimer);
      }
      entry.abort = undefined;
    }
  })().catch((error) => {
    pdfBufferCache.delete(fileUrl);
    throw error;
  });

  pdfBufferCache.set(fileUrl, entry);
  trimCache();
  return entry;
}

function getPdfBufferEntry(fileUrl: string) {
  const existingEntry = pdfBufferCache.get(fileUrl);
  if (existingEntry) {
    pdfBufferCache.delete(fileUrl);
    pdfBufferCache.set(fileUrl, existingEntry);
    return existingEntry;
  }

  return createPdfBufferEntry(fileUrl);
}

export function preloadPdfBuffer(fileUrl: string) {
  void getPdfBufferEntry(fileUrl).promise.catch(() => undefined);
}

export function invalidatePdfBuffer(fileUrl: string) {
  const entry = pdfBufferCache.get(fileUrl);
  if (!entry) return;

  entry.abort?.();
  pdfBufferCache.delete(fileUrl);
}

export function loadPdfBuffer(
  fileUrl: string,
  onProgress?: ProgressListener,
) {
  const entry = getPdfBufferEntry(fileUrl);

  if (onProgress) {
    entry.listeners.add(onProgress);
    if (entry.buffer) {
      onProgress(100);
    }
  }

  return {
    promise: entry.promise,
    unsubscribe: () => {
      if (onProgress) {
        entry.listeners.delete(onProgress);
      }
    },
  };
}
