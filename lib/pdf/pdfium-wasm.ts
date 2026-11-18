import { PDFIUM_WASM_URL } from "../generated/pdfium-wasm";
import { fetchPdfResource } from "./fetch-resource";

// One download of the engine per page, shared by the course-page prefetch,
// card warm-up, preload hint and viewer. Separate requests for the same URL
// are not merged by the browser: a second one re-downloads 1.65 MB.
let download: Promise<ArrayBuffer> | null = null;
// Stays set after release: the HTTP cache holds the engine for this page, so
// a later preload hint would only produce an unused-preload warning.
let requested = false;

export function loadPdfiumWasm() {
  requested = true;
  if (!download) {
    const attempt = fetchPdfResource(PDFIUM_WASM_URL, { kind: "wasm" }).catch((error) => {
      // A released download can fail after a newer one has started.
      if (download === attempt) {
        download = null;
        requested = false;
      }
      throw error;
    });
    download = attempt;
  }
  return download;
}

export function isPdfiumWasmRequested() {
  return requested;
}

/**
 * Drop the bytes once the engine is built; a later rebuild reads the HTTP
 * cache. Given a download, drops it only if it is still the current one.
 */
export function releasePdfiumWasm(attempt: Promise<ArrayBuffer> | null = download) {
  if (download === attempt) download = null;
}

// Engine builds waiting on each download.
const builds = new WeakMap<Promise<ArrayBuffer>, number>();

/**
 * The shared download for one engine build, and a release for when the build
 * is done with it. Settled bytes are dropped right away: they were copied into
 * the engine or the build failed. A download still in flight is kept so a
 * retry joins it, and dropped when it settles unless another build has joined.
 */
export function holdPdfiumWasm() {
  const wasm = loadPdfiumWasm();
  builds.set(wasm, (builds.get(wasm) ?? 0) + 1);
  let settled = false;
  const markSettled = () => { settled = true; };
  wasm.then(markSettled, markSettled);
  let released = false;
  return {
    wasm,
    release() {
      if (released) return;
      released = true;
      builds.set(wasm, (builds.get(wasm) ?? 1) - 1);
      if (settled) {
        releasePdfiumWasm(wasm);
        return;
      }
      const releaseIfAbandoned = () => {
        if (!builds.get(wasm)) releasePdfiumWasm(wasm);
      };
      wasm.then(releaseIfAbandoned, releaseIfAbandoned);
    },
  };
}
