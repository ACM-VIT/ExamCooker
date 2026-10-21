import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { PDFIUM_WASM_URL } from "../generated/pdfium-wasm";

const PAPER_ID = "cmoeqf27601vqa8v3nk8b8gdf";
const PAPER = `https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/${PAPER_ID}/paper.pdf`;

test("a cold load's server HTML preloads the engine and the PDF", async () => {
  const { preloadPdfResources } = await import("./preload-resources");
  function Hints() {
    preloadPdfResources(PAPER);
    return null;
  }
  const html = renderToStaticMarkup(createElement("html", null, createElement("head"), createElement("body", null, createElement(Hints))));
  assert.match(html, new RegExp(`<link rel="preload" href="${PDFIUM_WASM_URL}"`));
  assert.match(html, new RegExp(`<link rel="preload" href="[^"]*${PAPER_ID}[^"]*"`));
});

test("once this page requested the engine, only the PDF is preloaded", async (t) => {
  const window = new Window({ url: "https://examcooker.acmvit.in/past_papers/BMAT101L" });
  const globals: Record<string, unknown> = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
  };
  const originals = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const originalFetch = globalThis.fetch;
  let finishDownload!: () => void;
  globalThis.fetch = (() => new Promise<Response>((resolve) => {
    finishDownload = () => resolve(new Response(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])));
  })) as typeof fetch;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  });

  // Loading the client renderer installs the dispatcher behind react-dom's preload().
  await import("react-dom/client");
  const { preloadPdfResources } = await import("./preload-resources");
  const { loadPdfiumWasm, releasePdfiumWasm } = await import("./pdfium-wasm");
  const preloads = () => [...window.document.head.querySelectorAll('link[rel="preload"]')]
    .map((link) => link.getAttribute("href") ?? "");

  const download = loadPdfiumWasm();
  preloadPdfResources(PAPER);
  assert.equal(preloads().some((href) => href.endsWith(PDFIUM_WASM_URL)), false, "no second download while one runs");
  assert.equal(preloads().some((href) => href.includes(PAPER_ID)), true);

  finishDownload();
  await download;
  releasePdfiumWasm();
  preloadPdfResources(PAPER);
  assert.equal(preloads().some((href) => href.endsWith(PDFIUM_WASM_URL)), false, "no unused preload after the engine is built");
});
