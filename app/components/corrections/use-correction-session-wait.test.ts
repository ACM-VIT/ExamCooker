import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Activity, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { useCorrectionSessionWait } from "./use-correction-session-wait";

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
  const restore = async () => {
    await window.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  };
  return { restore, window };
}

type SessionWait = ReturnType<typeof useCorrectionSessionWait>;

async function renderProbe(t: TestContext) {
  const { restore, window } = installDom();
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root: Root = createRoot(host as unknown as HTMLElement);
  // React must unmount before the window closes.
  t.after(async () => {
    await act(async () => root.unmount());
    await restore();
  });
  const probe: { current: SessionWait | null } = { current: null };

  function Probe() {
    probe.current = useCorrectionSessionWait();
    return createElement(
      "span",
      null,
      probe.current.awaitingSession ? "Sending…" : "Send report",
    );
  }

  const render = async (mode: "hidden" | "visible") => {
    await act(async () => {
      root.render(createElement(Activity, { mode, children: createElement(Probe) }));
    });
  };
  await render("visible");
  return { host, probe: probe as { current: SessionWait }, render };
}

test("cancelling a stalled session wait releases the form and retires its check", async (t) => {
  const { host, probe } = await renderProbe(t);

  let isCurrent = () => true;
  await act(async () => {
    isCurrent = probe.current.startWait();
  });
  assert.equal(host.textContent, "Sending…");
  assert.equal(isCurrent(), true);

  // The user cancels while /api/auth/session has not answered.
  await act(async () => probe.current.endWait());
  assert.equal(host.textContent, "Send report");
  // A late session answer must neither send the report nor redirect.
  assert.equal(isCurrent(), false);

  // Submitting again starts a new wait; only its check is current.
  let nextIsCurrent = () => false;
  await act(async () => {
    nextIsCurrent = probe.current.startWait();
  });
  assert.equal(nextIsCurrent(), true);
  assert.equal(isCurrent(), false);
});

test("Activity hide clears a correction report waiting for auth", async (t) => {
  const { host, probe, render } = await renderProbe(t);

  let isCurrent = () => true;
  await act(async () => {
    isCurrent = probe.current.startWait();
  });
  assert.equal(host.textContent, "Sending…");
  await render("hidden");
  await render("visible");
  assert.equal(host.textContent, "Send report");
  assert.equal(isCurrent(), false);
});
