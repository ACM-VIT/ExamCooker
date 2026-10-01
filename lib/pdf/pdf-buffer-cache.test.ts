import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { invalidatePdfBuffer, loadPdfBuffer } from "./pdf-buffer-cache";

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
  assert.deepEqual(cacheModes, ["force-cache", "reload"]);
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
