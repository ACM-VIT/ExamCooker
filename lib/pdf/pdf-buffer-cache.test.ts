import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { invalidatePdfBuffer, loadPdfBuffer, preloadPdfBuffer } from "./pdf-buffer-cache";

const realFetch = globalThis.fetch;
const originalAssetBase = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
const pdf = () => new Response("%PDF-1.7\nexample", {
  headers: { "content-type": "application/pdf" },
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (originalAssetBase === undefined) delete process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  else process.env.NEXT_PUBLIC_ASSET_BASE_URL = originalAssetBase;
});

test("a cancelled download cannot evict its replacement", async () => {
  let rejectOld!: (error: Error) => void;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    if (requests === 1) return new Promise<Response>((_, reject) => { rejectOld = reject; });
    return pdf();
  };
  const url = "https://example.test/replacement.pdf";
  const old = loadPdfBuffer(url);
  const oldRejected = assert.rejects(old.promise);
  invalidatePdfBuffer(url);
  const replacement = loadPdfBuffer(url);
  await replacement.promise;
  rejectOld(new DOMException("Aborted", "AbortError"));
  await oldRejected;
  assert.equal(await loadPdfBuffer(url).promise, await replacement.promise);
  assert.equal(requests, 2, "the completed replacement should stay cached");
});

test("a transient network failure recovers without a manual retry", async () => {
  const cacheModes: RequestCache[] = [];
  globalThis.fetch = async (_url, options) => {
    cacheModes.push(options?.cache as RequestCache);
    if (cacheModes.length === 1) throw new TypeError("Failed to fetch");
    return pdf();
  };
  const result = await loadPdfBuffer("https://example.test/retry.pdf").promise;
  assert.ok(result.byteLength > 0);
  assert.deepEqual(cacheModes, ["default", "reload"]);
});

test("a missing PDF fails once rather than retrying a permanent HTTP error", async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response("Missing", { status: 404 }); };
  await assert.rejects(loadPdfBuffer("https://example.test/missing.pdf").promise, /404/);
  assert.equal(requests, 1);
});

test("an HTML error cached as 200 is discarded and fetched again", async () => {
  let requests = 0;
  globalThis.fetch = async () => ++requests === 1
    ? new Response("<!doctype html>upstream error", { headers: { "content-type": "text/html" } })
    : pdf();
  const result = await loadPdfBuffer("https://example.test/bad-cache.pdf").promise;
  assert.match(new TextDecoder().decode(result), /^%PDF-/);
  assert.equal(requests, 2);
});

test("permanently broken downloads have a bounded retry count", async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new TypeError("Failed to fetch"); };
  await assert.rejects(loadPdfBuffer("https://example.test/offline.pdf").promise, /fetch/);
  assert.equal(requests, 2);
});

test("a blocked public paper host recovers through same-origin delivery", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length === 1) throw new TypeError("Failed to fetch");
    return pdf();
  };
  const url = "https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/cmoeqcw9201s8a8v3n2fetot5/paper.pdf";
  const result = await loadPdfBuffer(url).promise;
  assert.ok(result.byteLength > 0);
  assert.deepEqual(urls, [url, "/api/pdf/paper/cmoeqcw9201s8a8v3n2fetot5"]);
});

test("syllabus loading avoids the origin that rejects browser CORS", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return pdf(); };
  await loadPdfBuffer("https://ec-syllabus.acmvit.in/files/syllabi/BCSE332L_Deep_Learning.pdf").promise;
  assert.deepEqual(urls, ["/api/pdf/syllabus/BCSE332L_Deep_Learning.pdf"]);
});

test("Cloudflare loads legacy PDFs through R2 and recovers a failed R2 request from Azure", async () => {
  process.env.NEXT_PUBLIC_ASSET_BASE_URL = "https://ec-assets.acmvit.in";
  const source = "https://examcookerprodsi.blob.core.windows.net/exam-assets/r2-recovery.pdf";
  const urls: string[] = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (urls.length === 1) throw new TypeError("Failed to fetch");
    return pdf();
  };
  assert.ok((await loadPdfBuffer(source).promise).byteLength > 0);
  assert.deepEqual(urls, ["https://ec-assets.acmvit.in/r2-recovery.pdf", source]);
});

test("R2 paper recovery retains the same-origin route and the two-attempt limit", async () => {
  process.env.NEXT_PUBLIC_ASSET_BASE_URL = "https://ec-assets.acmvit.in";
  const id = "r2-paper-recovery-fixture";
  const source = `https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/${id}/paper.pdf`;
  const urls: string[] = [];
  globalThis.fetch = async url => { urls.push(String(url)); return new Response(null, { status: 503 }); };
  await assert.rejects(loadPdfBuffer(source).promise, /503/);
  assert.deepEqual(urls, [`https://ec-assets.acmvit.in/past-papers/${id}/paper.pdf`, `/api/pdf/paper/${id}`]);
});

test("fallback failure stops after two requests and cancellation never starts it", async () => {
  const url = "https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/cmoeq1rlo00lra8v3fqhl2qpy/paper.pdf";
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new TypeError("Failed to fetch"); };
  await assert.rejects(loadPdfBuffer(url).promise, /fetch/);
  assert.equal(requests, 2);
  globalThis.fetch = async () => { requests++; throw new DOMException("Cancelled", "AbortError"); };
  await assert.rejects(loadPdfBuffer(url).promise, /Cancelled/);
  assert.equal(requests, 3);
});

function pendingUntilAborted(signals: AbortSignal[]) {
  return (_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_, reject) => {
    const signal = options?.signal as AbortSignal;
    signals.push(signal);
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}

test("evicting an awaited download lets it finish; an unawaited preload is cancelled", async () => {
  const signals: AbortSignal[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/awaited.pdf")) {
      signals.push(options?.signal as AbortSignal);
      await gate;
      return pdf();
    }
    return pendingUntilAborted(signals)(url, options);
  };
  const awaited = loadPdfBuffer("https://example.test/evict/awaited.pdf");
  preloadPdfBuffer("https://example.test/evict/preload.pdf");
  const fillers = Array.from({ length: 8 }, (_, index) => `https://example.test/evict/filler-${index}.pdf`);
  fillers.forEach(preloadPdfBuffer);
  assert.equal(signals[0].aborted, false, "a consumer is still waiting for this download");
  assert.equal(signals[1].aborted, true, "nobody waits for the evicted preload");
  release();
  assert.ok((await awaited.promise).byteLength > 0);
  fillers.forEach(invalidatePdfBuffer);
  assert.ok(signals.every((signal, index) => index === 0 || signal.aborted));
});

test("invalidating cancels an abandoned download but not one still awaited", async () => {
  const signals: AbortSignal[] = [];
  globalThis.fetch = pendingUntilAborted(signals);
  const url = "https://example.test/invalidate/shared.pdf";
  const first = loadPdfBuffer(url);
  const second = loadPdfBuffer(url);
  first.unsubscribe();
  invalidatePdfBuffer(url);
  assert.equal(signals[0].aborted, false, "the second consumer still waits");
  second.unsubscribe();
  assert.equal(signals[0].aborted, true, "the detached download has no consumers left");
  await assert.rejects(second.promise, { name: "AbortError" });
});

test("a PDF larger than the byte budget stays cached while it is the latest", async () => {
  let requests = 0;
  const large = new Uint8Array(33 * 1024 * 1024);
  large.set(new TextEncoder().encode("%PDF-1.7"));
  globalThis.fetch = async () => { requests++; return new Response(large, { headers: { "content-type": "application/pdf" } }); };
  const url = "https://example.test/budget/large.pdf";
  await loadPdfBuffer(url).promise;
  await loadPdfBuffer(url).promise;
  assert.equal(requests, 1);
});
