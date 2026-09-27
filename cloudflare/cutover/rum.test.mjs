import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("./rum.js.txt", import.meta.url), "utf8");
function harness(path = "/past_papers/BMEE209L/paper/example", hidden = false) {
  const events = [], callbacks = {}, observers = {};
  let now = 1200;
  const location = { pathname: path, href: `https://examcooker.test${path}`, origin: "https://examcooker.test" };
  const listen = (target, type, fn) => (callbacks[`${target}:${type}`] ??= []).push(fn);
  const document = {
    currentScript: { dataset: { backend: "cloudflare", token: "signed-context" } },
    visibilityState: hidden ? "hidden" : "visible", readyState: "complete",
    addEventListener: (type, fn) => listen("document", type, fn),
  };
  class Image {
    src = "blob:pdf";
    naturalWidth = 612;
    dataset = { ecPdfPageImage: "true" };
    checkVisibility() { return true; }
    getBoundingClientRect() { return { top: 100, bottom: 800, left: 0, right: 600 }; }
  }
  const window = { fetch: async () => new Response("ok"), addEventListener: (type, fn) => listen("window", type, fn) };
  const history = Object.fromEntries(["pushState", "replaceState"].map(method => [method, (_state, _title, url) => {
    if (url) location.pathname = new URL(url, location.href).pathname;
  }]));
  vm.runInNewContext(source, {
    window, document, location, history, HTMLImageElement: Image, URL, Request, Headers, innerWidth: 1000, innerHeight: 900,
    Blob: class { constructor(parts) { this.text = parts.join(""); } },
    navigator: { sendBeacon(_url, blob) { events.push(JSON.parse(blob.text)); } },
    performance: { now: () => now, getEntriesByType: () => [] },
    requestAnimationFrame: fn => fn(),
    PerformanceObserver: class {
      constructor(fn) { this.fn = fn; }
      observe({ type }) { observers[type] = this; }
      takeRecords() { return []; }
      disconnect() { this.disconnected = true; }
    },
  });
  return {
    events, history, document, Image,
    emit(target, type, event = {}) { for (const fn of callbacks[`${target}:${type}`] ?? []) fn(event); },
    observe(type, entry) { observers[type].fn({ getEntries: () => [entry] }); },
    time(value) { now = value; },
  };
}

test("first visible PDF is measured once with the corrected metric version", () => {
  const h = harness();
  h.emit("document", "load", { target: new h.Image() });
  h.emit("document", "load", { target: new h.Image() });
  assert.deepEqual(h.events.filter(e => e.event === "ec_cutover_pdf"), [{ token: "signed-context", event: "ec_cutover_pdf", measurement_version: 2, value: 1200 }]);
});

test("opening a PDF after SPA navigation never uses the previous document clock", () => {
  const h = harness("/");
  h.time(300_000);
  h.history.pushState({}, "", "/past_papers/BMEE209L/paper/example");
  h.emit("document", "load", { target: new h.Image() });
  assert.equal(h.events.filter(e => e.event === "ec_cutover_pdf").length, 0);
});

test("background time and offscreen page images do not become PDF latency", () => {
  const h = harness();
  const image = new h.Image();
  image.getBoundingClientRect = () => ({ top: 1000, bottom: 1600, left: 0, right: 600 });
  h.emit("document", "load", { target: image });
  h.document.visibilityState = "hidden";
  h.emit("document", "visibilitychange");
  h.document.visibilityState = "visible";
  h.time(300_000);
  h.emit("document", "load", { target: new h.Image() });
  assert.equal(h.events.filter(e => e.event === "ec_cutover_pdf").length, 0);
});

test("LCP stops on interaction and CLS stops when the route changes", () => {
  const h = harness();
  h.observe("largest-contentful-paint", { startTime: 1100 });
  h.emit("window", "pointerdown");
  h.observe("largest-contentful-paint", { startTime: 60_000 });
  h.observe("layout-shift", { startTime: 1300, value: 0.05 });
  h.history.replaceState({}, "", "/past_papers");
  h.observe("layout-shift", { startTime: 1400, value: 0.9 });
  h.emit("window", "pagehide");
  assert.deepEqual(h.events.map(e => [e.metric, e.value]), [["LCP", 1100], ["CLS", 0.05]]);
});

test("a document opened in the background does not report foreground vitals", () => {
  const h = harness(undefined, true);
  h.observe("largest-contentful-paint", { startTime: 300_000 });
  h.document.visibilityState = "visible";
  h.emit("document", "load", { target: new h.Image() });
  h.emit("window", "pagehide");
  assert.equal(h.events.length, 0);
});
