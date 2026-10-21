import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

const PAPER_ID = "cmoeqf27601vqa8v3nk8b8gdf";
const PAPER = `https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/${PAPER_ID}/paper.pdf`;

test("the engine preload is skipped while the shared download runs, not the PDF preload", async (t) => {
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
  const { PDFIUM_WASM_URL } = await import("../generated/pdfium-wasm");
  const preloads = () => [...window.document.head.querySelectorAll('link[rel="preload"]')]
    .map((link) => link.getAttribute("href") ?? "");

  const download = loadPdfiumWasm();
  preloadPdfResources(PAPER);
  assert.equal(preloads().some((href) => href.endsWith(PDFIUM_WASM_URL)), false);
  assert.equal(preloads().some((href) => href.includes(PAPER_ID)), true);

  finishDownload();
  await download;
  releasePdfiumWasm();
  preloadPdfResources(PAPER);
  assert.equal(preloads().some((href) => href.endsWith(PDFIUM_WASM_URL)), true);
});
