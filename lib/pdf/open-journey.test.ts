import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Window } from "happy-dom";
import { installPdfOpenJourneyTracking } from "./open-journey";

function viewer(t: TestContext) {
  const window = new Window({ url: "https://examcooker.test/past_papers/TEST" });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const globals = {
    window, document: window.document, location: window.location,
    Element: window.Element, HTMLElement: window.HTMLElement, HTMLImageElement: window.HTMLImageElement,
    MutationObserver: window.MutationObserver,
    IntersectionObserver: class {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe(target: unknown) { this.callback([{ target, isIntersecting: true, intersectionRect: { width: 20, height: 30 } }]); }
      disconnect() {}
    },
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    clearTimeout: window.clearTimeout.bind(window),
  };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, Object.fromEntries(Object.entries(globals).map(([key, value]) => [key, { value, configurable: true }])));
  Object.defineProperty(window.Element.prototype, "checkVisibility", { value: () => true });
  Object.defineProperty(window.document, "visibilityState", { value: "visible", configurable: true });
  const events: { event: string; outcome?: string | number | boolean; preview_visible_ms?: string | number | boolean }[] = [];
  const tracker = installPdfOpenJourneyTracking({ build: "fixture", backend: "cloudflare", capture: (event, properties) => events.push({ event, ...properties }) });
  t.after(async () => {
    tracker.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  });
  const path = "/past_papers/TEST/paper/one";
  const root = window.document.createElement("div");
  root.dataset.ecPdfJourneyPath = path;
  const image = window.document.createElement("img");
  image.dataset.ecPdfPageImage = "true";
  image.src = "blob:https://examcooker.test/page-one";
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 20 } });
  let resolveDecode!: () => void;
  let rejectDecode!: (error: Error) => void;
  const decoded = new Promise<void>((resolve, reject) => { resolveDecode = resolve; rejectDecode = reject; });
  image.decode = () => decoded;
  root.append(image);
  window.document.body.append(root);
  tracker.start(path, "push");
  window.history.pushState({}, "", path);
  const paint = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  };
  return { window, root, image, tracker, paint, resolveDecode, rejectDecode, events,
    finished: () => events.filter(event => event.event === "pdf_open_finished").map(event => event.outcome) };
}

test("a first-page preview is recorded but does not finish the PDF open", async t => {
  const v = viewer(t);
  const preview = v.window.document.createElement("img");
  preview.dataset.ecPdfPreview = "true";
  preview.src = "https://ec-assets.test/_preview/v1/past-papers/one/p0-r0.webp";
  Object.defineProperties(preview, { complete: { value: true }, naturalWidth: { value: 20 } });
  preview.decode = () => Promise.resolve();
  v.root.prepend(preview);
  await Promise.resolve();
  v.paint(); v.paint();
  await Promise.resolve();
  v.paint(); v.paint();
  assert.deepEqual(v.finished(), [], "a preview image is not the interactive PDF page");
  v.resolveDecode();
  await Promise.resolve();
  v.paint(); v.paint();
  const [finished] = v.events.filter(event => event.event === "pdf_open_finished");
  assert.equal(finished.outcome, "visible");
  assert.equal(typeof finished.preview_visible_ms, "number");
});

test("PDF timing waits for decode and a subsequent paint boundary", async t => {
  const v = viewer(t);
  v.paint(); v.paint();
  assert.deepEqual(v.finished(), [], "complete and naturalWidth do not mean decoded pixels are ready");
  v.resolveDecode();
  await Promise.resolve();
  assert.deepEqual(v.finished(), []);
  v.paint();
  assert.deepEqual(v.finished(), [], "decoding must be followed by a paint boundary");
  v.paint();
  assert.deepEqual(v.finished(), ["visible"]);
});

for (const change of ["detached", "backgrounded", "superseded", "replaced", "rejected", "disposed"] as const) {
  test(`a ${change} image cannot finish a pending PDF decode`, async t => {
    const v = viewer(t);
    v.paint(); v.paint();
    assert.deepEqual(v.finished(), []);
    if (change === "detached") v.image.remove();
    if (change === "backgrounded") {
      Object.defineProperty(v.window.document, "visibilityState", { value: "hidden" });
      v.window.document.dispatchEvent(new v.window.Event("visibilitychange"));
    }
    if (change === "superseded") {
      v.tracker.start("/past_papers/TEST/paper/two", "push");
      v.window.history.pushState({}, "", "/past_papers/TEST/paper/two");
    }
    if (change === "replaced") {
      v.image.src = "blob:https://examcooker.test/page-two";
      v.image.decode = () => new Promise(() => {});
    }
    if (change === "disposed") v.tracker.dispose();
    if (change === "rejected") v.rejectDecode(new Error("decode failed"));
    else v.resolveDecode();
    await Promise.resolve();
    v.paint(); v.paint();
    assert.deepEqual(v.finished(), change === "backgrounded" || change === "superseded" ? [change] : []);
  });
}
