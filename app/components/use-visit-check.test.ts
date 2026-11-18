import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Activity, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import { useVisitCheck } from "./use-visit-check";

function installDom() {
  const window = new Window({ url: "https://examcooker.test/resource" });
  const globals: Record<string, unknown> = {
    document: window.document,
    Element: window.Element,
    Event: window.Event,
    HTMLElement: window.HTMLElement,
    HTMLIFrameElement: window.HTMLIFrameElement,
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

async function renderProbe(t: TestContext) {
  const { window, restore } = installDom();
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  let startCheck!: () => () => boolean;
  function Probe() {
    startCheck = useVisitCheck();
    return null;
  }
  const render = (mode: "hidden" | "visible") =>
    act(async () => {
      root.render(createElement(Activity, { mode, children: createElement(Probe) }));
    });
  // React must unmount before the DOM it renders into is closed.
  t.after(async () => {
    await act(async () => root.unmount());
    await restore();
  });
  await render("visible");
  return { startCheck: () => startCheck(), render };
}

test("work stays current while the page stays visible", async (t) => {
  const { startCheck, render } = await renderProbe(t);
  const isCurrent = startCheck();
  await render("visible");
  assert.equal(isCurrent(), true);
});

test("work started before the page was hidden is stale after it returns", async (t) => {
  const { startCheck, render } = await renderProbe(t);
  const isCurrent = startCheck();
  await render("hidden");
  await render("visible");
  assert.equal(isCurrent(), false);
  assert.equal(startCheck()(), true);
});
