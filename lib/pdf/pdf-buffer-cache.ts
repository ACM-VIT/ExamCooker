import { fetchPdfResource } from "./fetch-resource";

type ProgressListener = (progress: number | null) => void;

// An entry is either downloading or loaded. A download that fails or is
// aborted leaves the cache. A downloading entry with consumers is pinned:
// eviction and invalidation only detach it, so its awaited request finishes.
type PdfBufferCacheEntry = {
  promise: Promise<ArrayBuffer>;
  listeners: Set<ProgressListener>;
  consumers: number;
  state: { status: "downloading"; abort: () => void } | { status: "loaded"; buffer: ArrayBuffer };
};

const MAX_CACHE_ENTRIES = 8;
const MAX_CACHED_BYTES = 32 * 1024 * 1024;
const pdfBufferCache = new Map<string, PdfBufferCacheEntry>();

function cachedBytes() {
  let total = 0;
  for (const entry of pdfBufferCache.values()) {
    if (entry.state.status === "loaded") total += entry.state.buffer.byteLength;
  }
  return total;
}

function detach(fileUrl: string, entry: PdfBufferCacheEntry) {
  if (pdfBufferCache.get(fileUrl) === entry) pdfBufferCache.delete(fileUrl);
  // Only an unconsumed download (a preload) is cancelled. Anyone awaiting the
  // promise keeps their request; the next load starts a fresh entry.
  if (entry.state.status === "downloading" && entry.consumers === 0) entry.state.abort();
}

function trimCache() {
  // The most recently used entry is never evicted, so a single PDF larger than
  // the byte budget stays cached while it is the one being viewed.
  const keys = [...pdfBufferCache.keys()].slice(0, -1);
  for (const key of keys) {
    if (pdfBufferCache.size <= MAX_CACHE_ENTRIES && cachedBytes() <= MAX_CACHED_BYTES) return;
    const entry = pdfBufferCache.get(key);
    if (!entry || (entry.state.status === "downloading" && entry.consumers > 0)) continue;
    detach(key, entry);
  }
}

function createPdfBufferEntry(fileUrl: string): PdfBufferCacheEntry {
  const controller = new AbortController();
  const entry: PdfBufferCacheEntry = {
    listeners: new Set(),
    consumers: 0,
    state: { status: "downloading", abort: () => controller.abort() },
    promise: Promise.resolve(new ArrayBuffer(0)),
  };

  entry.promise = fetchPdfResource(fileUrl, {
    kind: "pdf",
    signal: controller.signal,
    onProgress: (progress) => {
      for (const listener of entry.listeners) listener(progress);
    },
  }).then(
    (buffer) => {
      entry.state = { status: "loaded", buffer };
      if (pdfBufferCache.get(fileUrl) === entry) trimCache();
      return buffer;
    },
    (error: unknown) => {
      // A cancelled request can settle after a replacement has started.
      if (pdfBufferCache.get(fileUrl) === entry) pdfBufferCache.delete(fileUrl);
      throw error;
    },
  );

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

/** Drops the cached copy so the next load fetches again. */
export function invalidatePdfBuffer(fileUrl: string) {
  const entry = pdfBufferCache.get(fileUrl);
  if (entry) detach(fileUrl, entry);
}

export function loadPdfBuffer(
  fileUrl: string,
  onProgress?: ProgressListener,
) {
  const entry = getPdfBufferEntry(fileUrl);
  entry.consumers++;
  if (onProgress) {
    entry.listeners.add(onProgress);
    if (entry.state.status === "loaded") onProgress(100);
  }

  let released = false;
  return {
    promise: entry.promise,
    /** Stops progress updates and releases this consumer's hold on the download. */
    unsubscribe: () => {
      if (released) return;
      released = true;
      entry.consumers--;
      if (onProgress) entry.listeners.delete(onProgress);
      // A download nobody waits for and nobody can reach again is cancelled.
      if (entry.consumers === 0 && entry.state.status === "downloading" && pdfBufferCache.get(fileUrl) !== entry) {
        entry.state.abort();
      }
    },
  };
}
