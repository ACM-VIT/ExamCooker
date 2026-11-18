import assert from "node:assert/strict";
import { test } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import { usePreloadedPdfiumEngine } from "./pdfium-engine-cache";

function installDom() {
  const window = new Window({ url: "https://examcooker.test/paper" });
  const globals: Record<string, unknown> = {
    document: window.document,
    HTMLElement: window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    navigator: window.navigator,
    Node: window.Node,
    window,
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  Object.defineProperties(
    globalThis,
    Object.fromEntries(
      Object.entries(globals).map(([key, value]) => [key, { configurable: true, value, writable: true }]),
    ),
  );
  const restore = async () => {
    await window.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  };
  return { window, restore };
}

async function until(condition: () => boolean) {
  for (let turn = 0; turn < 200 && !condition(); turn++) {
    await act(() => new Promise((resolve) => setImmediate(resolve)));
  }
  assert.ok(condition(), "timed out waiting for the engine state");
}

test("a retry that joined a pending build starts a new one when it fails", async (t) => {
  const { window, restore } = installDom();
  // Each engine build waits on one WASM request; answer them by hand.
  const requests: Array<(response: Response) => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => new Promise<Response>((resolve) => requests.push(resolve))) as typeof fetch;

  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  let status = "";
  function Probe({ retryKey }: { retryKey: number }) {
    status = usePreloadedPdfiumEngine(retryKey).status;
    return null;
  }
  const render = (retryKey: number) =>
    act(async () => {
      root.render(createElement(Probe, { retryKey }));
    });
  t.after(async () => {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    await restore();
  });

  await render(0);
  assert.equal(requests.length, 1);
  // Retry while the engine is still waiting on the WASM response.
  await render(1);
  assert.equal(requests.length, 1, "the retry joins the build in flight");

  requests[0](new Response("unavailable", { status: 404 }));
  await until(() => requests.length === 2 || status === "error");
  assert.equal(requests.length, 2, "the failed shared build is followed by a fresh one");
  assert.equal(status, "loading");

  requests[1](new Response("unavailable", { status: 404 }));
  await until(() => status === "error");
  assert.equal(requests.length, 2, "the retry starts one fresh build, not a loop");
});
