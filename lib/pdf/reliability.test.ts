import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { foregroundTimeout } from "./foreground-timeout";
import { engineDeadline, PDFIUM_ENGINE_LOAD_TIMEOUT_MS } from "./load-engine";
import { fetchPdfResource, PDF_DOWNLOAD_STALL_TIMEOUT_MS } from "./fetch-resource";
import { preloadPdfBuffer } from "./pdf-buffer-cache";
import { pdfRenderOptions } from "./render-budget";

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

// Browsers error the fetch body with the signal's reason, so mirror that here.
function stallingFetch(recovered: boolean) {
  const reasons: unknown[] = [];
  globalThis.fetch = async (_url, options) => {
    if (recovered && reasons.length > 0) return new Response("%PDF-1.7\nrecovered");
    return new Response(new ReadableStream({
      start(controller) {
        options?.signal?.addEventListener("abort", () => {
          reasons.push(options.signal?.reason);
          controller.error(options.signal?.reason);
        });
      },
    }));
  };
  return reasons;
}

test("a stalled transfer is aborted with a named reason and retried once with fresh bytes", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const reasons = stallingFetch(true);
  const pending = fetchPdfResource("https://example.test/stalled.pdf", { kind: "pdf" });
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(PDF_DOWNLOAD_STALL_TIMEOUT_MS);
  assert.ok((await pending).byteLength > 0);
  assert.equal(reasons.length, 1);
  assert.ok(reasons[0] instanceof Error);
  assert.equal(reasons[0].name, "PdfDownloadError");
  assert.match(reasons[0].message, /stalled/);
});

test("a preload that stalls on every attempt fails without an unhandled rejection", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  process.on("unhandledRejection", onUnhandled);
  t.after(() => { process.off("unhandledRejection", onUnhandled); });
  const reasons = stallingFetch(false);
  const drain = () => new Promise(resolve => setImmediate(resolve));
  preloadPdfBuffer("https://example.test/preload-stalled.pdf");
  for (let attempt = 0; attempt < 2; attempt++) {
    await drain();
    t.mock.timers.tick(PDF_DOWNLOAD_STALL_TIMEOUT_MS);
  }
  await drain();
  assert.equal(reasons.length, 2);
  assert.deepEqual(unhandled, []);
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
    // Match the SDK's actual scale computation, including its dpr clamp.
    const renderedScale = (retry = false) => {
      const options = pdfRenderOptions(width, height, scale, deviceDpr, retry);
      return Math.max(0.01, options.scaleFactor) * Math.max(1, options.dpr);
    };
    assert.ok(width * height * renderedScale() ** 2 <= 6_000_001);
    assert.ok(Math.max(width, height) * renderedScale() <= 8193);
    assert.ok(renderedScale(true) < renderedScale());
  }
});
