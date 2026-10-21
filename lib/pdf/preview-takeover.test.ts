import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Window } from "happy-dom";
import { isPdfPreviewShown, watchPdfPreviewTakeover } from "./preview-takeover";

function viewer(t: TestContext) {
  const window = new Window({ url: "https://examcooker.test/past_papers/TEST/paper/one" });
  const globals = { HTMLImageElement: window.HTMLImageElement, MutationObserver: window.MutationObserver };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, Object.fromEntries(Object.entries(globals).map(([key, value]) => [key, { value, configurable: true }])));
  const root = window.document.createElement("div");
  window.document.body.append(root);
  let takeovers = 0;
  const stop = watchPdfPreviewTakeover(root as unknown as HTMLElement, () => { takeovers++; });
  t.after(async () => {
    stop();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  });
  const page = (index: number, painted = false) => {
    const image = window.document.createElement("img");
    image.dataset.ecPdfPageImage = "true";
    image.dataset.ecPdfPageIndex = String(index);
    if (painted) Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 20 } });
    return image;
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  return { window, root, page, settle, takeovers: () => takeovers };
}

test("only the first displayed page replaces the preview", async t => {
  const v = viewer(t);
  const second = v.page(1);
  v.root.append(second);
  second.dispatchEvent(new v.window.Event("load"));
  await v.settle();
  assert.equal(v.takeovers(), 0, "a buffered later page must not dismiss the preview");
  const first = v.page(0);
  v.root.append(first);
  first.dispatchEvent(new v.window.Event("load"));
  assert.equal(v.takeovers(), 1);
});

test("a first page that painted before the watcher attached is a takeover", async t => {
  const window = new Window();
  const root = window.document.createElement("div");
  const image = window.document.createElement("img");
  image.dataset.ecPdfPageImage = "true";
  image.dataset.ecPdfPageIndex = "0";
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 20 } });
  root.append(image);
  const originals = { HTMLImageElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLImageElement"), MutationObserver: Object.getOwnPropertyDescriptor(globalThis, "MutationObserver") };
  Object.defineProperties(globalThis, { HTMLImageElement: { value: window.HTMLImageElement, configurable: true }, MutationObserver: { value: window.MutationObserver, configurable: true } });
  t.after(async () => {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  });
  let takeovers = 0;
  watchPdfPreviewTakeover(root as unknown as HTMLElement, () => { takeovers++; })();
  assert.equal(takeovers, 1);
});

// The viewer inserts error states as new elements and switches view mode by
// changing an attribute on its existing content column.
for (const [name, change] of [
  ["a load error", (root: HTMLElement, column: HTMLElement) => { const error = column.ownerDocument.createElement("div"); error.dataset.ecPdfLoadError = "true"; root.append(error); }],
  ["a page error", (root: HTMLElement, column: HTMLElement) => { const error = column.ownerDocument.createElement("div"); error.dataset.ecPdfPageError = "true"; column.append(error); }],
  ["the Markdown view", (_root: HTMLElement, column: HTMLElement) => { column.dataset.ecPdfViewMode = "paper"; }],
] as const) {
  test(`${name} uncovers the viewer`, async t => {
    const v = viewer(t);
    const column = v.window.document.createElement("div");
    column.dataset.ecPdfViewMode = "pdf";
    v.root.append(column);
    await v.settle();
    assert.equal(v.takeovers(), 0);
    change(v.root as unknown as HTMLElement, column as unknown as HTMLElement);
    await v.settle();
    assert.equal(v.takeovers() > 0, true);
  });
}

test("saved page edits cannot bring back a preview for the same document", () => {
  const file = "https://storage/past-papers/one/paper.pdf";
  assert.equal(isPdfPreviewShown("https://assets/_preview/v1/past-papers/one/p0-r0.webp", file, null), true);
  // After takeover, an edit changes the preview URL but not the document.
  assert.equal(isPdfPreviewShown("https://assets/_preview/v1/past-papers/one/p0-r90.webp", file, file), false);
  // Navigating to another paper shows its preview.
  assert.equal(isPdfPreviewShown("https://assets/_preview/v1/past-papers/two/p0-r0.webp", "https://storage/past-papers/two/paper.pdf", file), true);
  assert.equal(isPdfPreviewShown(null, file, null), false);
});
