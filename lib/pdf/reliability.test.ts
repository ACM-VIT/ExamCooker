import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { foregroundTimeout } from "./foreground-timeout";
import { engineDeadline, PDFIUM_ENGINE_LOAD_TIMEOUT_MS } from "./load-engine";
import { fetchPdfResource, PDF_DOWNLOAD_STALL_TIMEOUT_MS } from "./fetch-resource";
import { pdfRenderDpr } from "./render-budget";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalFetch = globalThis.fetch;
afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
  globalThis.fetch = originalFetch;
});
function visibility() {
  const state = new EventTarget() as EventTarget & { visibilityState: string };
  state.visibilityState = "visible";
  Object.defineProperty(globalThis, "document", { configurable: true, value: state });
  return (value: string) => {
    state.visibilityState = value;
    state.dispatchEvent(new Event("visibilitychange"));
  };
}

test("watchdogs count foreground time and clean up after cancellation", t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const setVisibility = visibility();
  let expired = 0;
  foregroundTimeout(() => { expired++; }, 1000);
  t.mock.timers.tick(400);
  setVisibility("hidden");
  t.mock.timers.tick(60_000);
  assert.equal(expired, 0);
  setVisibility("visible");
  t.mock.timers.tick(599);
  assert.equal(expired, 0);
  t.mock.timers.tick(1);
  assert.equal(expired, 1);
  const cancel = foregroundTimeout(() => { expired++; }, 10);
  cancel();
  setVisibility("hidden");
  setVisibility("visible");
  t.mock.timers.tick(1000);
  assert.equal(expired, 1);
});

test("a late engine is destroyed after its initialization times out", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let finish!: (engine: object) => void;
  const lateEngine = {};
  const destroyed: object[] = [];
  const result = engineDeadline(new Promise<object>(resolve => { finish = resolve; }), engine => destroyed.push(engine));
  const rejected = assert.rejects(result, /initialization timed out/);
  t.mock.timers.tick(PDFIUM_ENGINE_LOAD_TIMEOUT_MS);
  await rejected;
  finish(lateEngine);
  await Promise.resolve();
  assert.deepEqual(destroyed, [lateEngine]);
});

test("active download progress can outlive the idle deadline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  let aborted = false;
  globalThis.fetch = async (_url, options) => {
    options?.signal?.addEventListener("abort", () => { aborted = true; stream.error(new DOMException("Aborted", "AbortError")); });
    return new Response(new ReadableStream({ start(controller) { stream = controller; } }));
  };
  const pending = fetchPdfResource("https://example.test/slow.pdf", { kind: "pdf" });
  const drain = () => new Promise(resolve => setImmediate(resolve));
  await drain();
  for (const chunk of ["%PDF-1.7\n", "slow", "but progressing"]) {
    t.mock.timers.tick(PDF_DOWNLOAD_STALL_TIMEOUT_MS - 100);
    stream.enqueue(new TextEncoder().encode(chunk));
    await drain();
  }
  stream.close();
  assert.ok((await pending).byteLength > 0);
  assert.equal(aborted, false);
});

test("WASM validates the response and retries an upstream 503", async () => {
  let requests = 0;
  globalThis.fetch = async () => ++requests === 1
    ? new Response("Unavailable", { status: 503 })
    : new Response(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  assert.equal((await fetchPdfResource("https://example.test/pdfium.wasm", { kind: "wasm" })).byteLength, 8);
  assert.equal(requests, 2);
});

test("a stalled transfer is aborted and retried once with fresh bytes", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let requests = 0;
  let aborted = false;
  globalThis.fetch = async (_url, options) => {
    if (++requests > 1) return new Response("%PDF-1.7\nrecovered");
    return new Response(new ReadableStream({
      start(controller) {
        options?.signal?.addEventListener("abort", () => {
          aborted = true;
          controller.error(new DOMException("Aborted", "AbortError"));
        });
      },
    }));
  };
  const pending = fetchPdfResource("https://example.test/stalled.pdf", { kind: "pdf" });
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(PDF_DOWNLOAD_STALL_TIMEOUT_MS);
  assert.ok((await pending).byteLength > 0);
  assert.equal(aborted, true);
  assert.equal(requests, 2);
});

test("explicit cancellation stops a transfer without retrying", async () => {
  const controller = new AbortController();
  let requests = 0;
  globalThis.fetch = async (_url, options) => {
    requests++;
    return new Response(new ReadableStream({
      start(stream) {
        options?.signal?.addEventListener("abort", () => stream.error(options.signal?.reason));
      },
    }));
  };
  const pending = fetchPdfResource("https://example.test/cancel.pdf", { kind: "pdf", signal: controller.signal });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await rejected;
  assert.equal(requests, 1);
});

test("rendering stays within the pixel budget at high zoom and retries at lower resolution", () => {
  for (const [width, height, scale, deviceDpr] of [[612, 792, 2, 3], [4000, 6000, 4, 2], [50000, 1000, 8, 2]]) {
    const dpr = pdfRenderDpr(width, height, scale, deviceDpr);
    assert.ok(width * height * scale ** 2 * dpr ** 2 <= 6_000_001);
    assert.ok(Math.max(width, height) * scale * dpr <= 8193);
    assert.ok(pdfRenderDpr(width, height, scale, deviceDpr, true) < dpr);
  }
});
