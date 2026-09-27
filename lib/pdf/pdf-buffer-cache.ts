import { fetchPdfResource } from "./fetch-resource";

type ProgressListener = (progress: number | null) => void;

type PdfBufferCacheEntry = {
  promise: Promise<ArrayBuffer>;
  listeners: Set<ProgressListener>;
  abort?: () => void;
  buffer?: ArrayBuffer;
};

const MAX_CACHE_ENTRIES = 8;
const MAX_CACHED_BYTES = 32 * 1024 * 1024;
const pdfBufferCache = new Map<string, PdfBufferCacheEntry>();

function evictPdfBufferEntry(fileUrl: string, entry: PdfBufferCacheEntry) {
  pdfBufferCache.delete(fileUrl);

  if (entry.listeners.size === 0) {
    entry.abort?.();
  }
}

function trimCache() {
  const cachedBytes = () => [...pdfBufferCache.values()].reduce((sum, entry) => sum + (entry.buffer?.byteLength ?? 0), 0);
  while (pdfBufferCache.size > MAX_CACHE_ENTRIES || cachedBytes() > MAX_CACHED_BYTES) {
    const oldestKey = pdfBufferCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    const oldestEntry = pdfBufferCache.get(oldestKey);
    if (!oldestEntry) {
      pdfBufferCache.delete(oldestKey);
      continue;
    }

    evictPdfBufferEntry(oldestKey, oldestEntry);
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

  const controller = new AbortController();
  entry.abort = () => controller.abort();
  entry.promise = fetchPdfResource(fileUrl, {
    kind: "pdf",
    signal: controller.signal,
    onProgress: (progress) => notify(entry, progress),
  }).then((buffer) => {
    entry.buffer = buffer;
    trimCache();
    return buffer;
  }).catch((error) => {
    // A cancelled/preloaded request can settle after a replacement has started.
    if (pdfBufferCache.get(fileUrl) === entry) pdfBufferCache.delete(fileUrl);
    throw error;
  }).finally(() => { entry.abort = undefined; });

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
