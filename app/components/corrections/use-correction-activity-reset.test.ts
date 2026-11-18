import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Activity, act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { useCorrectionActivityReset } from "./use-correction-activity-reset";

function installDom(t: TestContext) {
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
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  Object.defineProperties(
    globalThis,
    Object.fromEntries(
      Object.entries(globals).map(([key, value]) => [
        key,
        { configurable: true, value, writable: true },
      ]),
    ),
  );
  t.after(async () => {
    await window.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  });
  return window;
}

test("Activity hide clears a correction report waiting for auth", async (t) => {
  const window = installDom(t);
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root: Root = createRoot(host as unknown as HTMLElement);

  function Probe() {
    const [awaitingSession, setAwaitingSession] = useState(true);
    useCorrectionActivityReset(setAwaitingSession);
    return createElement("span", null, awaitingSession ? "Sending…" : "Send report");
  }

  try {
    const render = async (mode: "hidden" | "visible") => {
      await act(async () => {
        root.render(
          createElement(Activity, {
            mode,
            children: createElement(Probe),
          }),
        );
      });
    };

    await render("visible");
    assert.equal(host.textContent, "Sending…");
    await render("hidden");
    await render("visible");
    assert.equal(host.textContent, "Send report");
  } finally {
    await act(async () => root.unmount());
  }
});
