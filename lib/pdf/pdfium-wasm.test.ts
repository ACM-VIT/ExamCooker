import assert from "node:assert/strict";
import test from "node:test";
import { holdPdfiumWasm, isPdfiumWasmRequested, loadPdfiumWasm, releasePdfiumWasm } from "./pdfium-wasm";

const WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

test("every consumer shares one engine download until it is released", async (t) => {
  let requests = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { requests++; return new Response(WASM); }) as typeof fetch;
  t.after(() => { globalThis.fetch = original; releasePdfiumWasm(); });

  assert.equal(isPdfiumWasmRequested(), false);
  const prefetch = loadPdfiumWasm();
  const viewer = loadPdfiumWasm();
  assert.equal(viewer, prefetch, "the viewer joins the prefetch instead of downloading again");
  assert.equal(isPdfiumWasmRequested(), true, "the preload hint is skipped while a download is running");
  assert.equal((await viewer).byteLength, WASM.byteLength);
  assert.equal(requests, 1);

  releasePdfiumWasm();
  assert.equal(isPdfiumWasmRequested(), true, "a released engine is still in the HTTP cache");
  await loadPdfiumWasm();
  assert.equal(requests, 2, "after release a rebuild fetches again (from the HTTP cache)");
});

test("a failed download can be retried", async (t) => {
  let attempt = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => (++attempt <= 1 ? new Response("unavailable", { status: 404 }) : new Response(WASM))) as typeof fetch;
  t.after(() => { globalThis.fetch = original; releasePdfiumWasm(); });
  await assert.rejects(loadPdfiumWasm());
  assert.equal(isPdfiumWasmRequested(), false);
  assert.equal((await loadPdfiumWasm()).byteLength, WASM.byteLength);
});

function deferredFetch(t: test.TestContext) {
  const responses: Array<(response: Response) => void> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (() => new Promise<Response>((resolve) => responses.push(resolve))) as typeof fetch;
  t.after(() => { globalThis.fetch = original; releasePdfiumWasm(); });
  return responses;
}

// Lets the release that waits on a download run once the download lands.
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("a download abandoned by a build is dropped when it lands", async (t) => {
  const responses = deferredFetch(t);
  // The build's import timed out while the engine was still downloading.
  const abandoned = holdPdfiumWasm();
  abandoned.release();
  assert.equal(loadPdfiumWasm(), abandoned.wasm, "a retry can still join the download");

  responses[0](new Response(WASM));
  await abandoned.wasm;
  await settle();
  const next = loadPdfiumWasm();
  assert.notEqual(next, abandoned.wasm, "nothing holds the bytes once it lands");
  await settle();
  responses[1](new Response(WASM));
  await next;
});

test("a build that joined the download keeps it until that build is done", async (t) => {
  const responses = deferredFetch(t);
  const abandoned = holdPdfiumWasm();
  abandoned.release();
  const retry = holdPdfiumWasm();
  assert.equal(retry.wasm, abandoned.wasm);

  responses[0](new Response(WASM));
  await retry.wasm;
  await settle();
  assert.equal(loadPdfiumWasm(), retry.wasm, "the joining build still holds it");
  retry.release();
  const next = loadPdfiumWasm();
  assert.notEqual(next, retry.wasm);
  await settle();
  responses[1](new Response(WASM));
  await next;
});

test("an abandoned download landing does not drop a newer one", async (t) => {
  const responses = deferredFetch(t);
  const abandoned = holdPdfiumWasm();
  abandoned.release();
  releasePdfiumWasm();
  const replacement = loadPdfiumWasm();
  assert.notEqual(replacement, abandoned.wasm);

  responses[0](new Response(WASM));
  await abandoned.wasm;
  await settle();
  assert.equal(loadPdfiumWasm(), replacement);
  await settle();
  responses[1](new Response(WASM));
  await replacement;
});
