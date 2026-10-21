import assert from "node:assert/strict";
import test from "node:test";
import { isPdfiumWasmRequested, loadPdfiumWasm, releasePdfiumWasm } from "./pdfium-wasm";

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
  assert.equal(isPdfiumWasmRequested(), false);
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
