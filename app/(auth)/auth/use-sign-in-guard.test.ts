import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { Activity, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import { useSignInGuard } from "./use-sign-in-guard";

const stallMs = 40;

function installDom() {
  const window = new Window({ url: "https://examcooker.test/auth" });
  const globals: Record<string, unknown> = {
    document: window.document,
    Element: window.Element,
    Event: window.Event,
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

async function renderGuard(t: TestContext) {
  const { window, restore } = installDom();
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  let guard!: ReturnType<typeof useSignInGuard>;
  function Probe() {
    guard = useSignInGuard(stallMs);
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
  const begin = async (providerId: string) => {
    let release!: (() => void) | null;
    await act(async () => {
      release = guard.begin(providerId);
    });
    return release;
  };
  const wait = (ms: number) => act(() => delay(ms));
  const pageShow = (persisted: boolean) =>
    act(async () => {
      const event = new window.Event("pageshow");
      Object.defineProperty(event, "persisted", { value: persisted });
      window.dispatchEvent(event);
    });
  return { guard: () => guard, begin, wait, render, pageShow };
}

test("one sign-in runs at a time and its release unlocks the buttons", async (t) => {
  const { guard, begin } = await renderGuard(t);
  const release = await begin("google");
  assert.ok(release);
  assert.equal(guard().signingInProviderId, "google");
  assert.equal(await begin("apple"), null);
  await act(async () => release());
  assert.equal(guard().signingInProviderId, null);
});

test("a stalled sign-in stays locked and reports the stall instead of unlocking", async (t) => {
  const { guard, begin, wait } = await renderGuard(t);
  await begin("google");
  assert.equal(guard().stalled, false);
  await wait(stallMs * 3);
  assert.equal(guard().stalled, true);
  assert.equal(guard().signingInProviderId, "google", "the redirect may still be loading");
  assert.equal(await begin("apple"), null);
});

test("a late release from an earlier attempt leaves the current one locked", async (t) => {
  const { guard, begin, pageShow } = await renderGuard(t);
  const releaseFirst = await begin("google");
  await pageShow(true);
  assert.equal(guard().signingInProviderId, null);
  await begin("apple");
  await act(async () => releaseFirst?.());
  assert.equal(guard().signingInProviderId, "apple");
});

test("only a back/forward cache restore ends the attempt", async (t) => {
  const { guard, begin, pageShow } = await renderGuard(t);
  await begin("google");
  await pageShow(false);
  assert.equal(guard().signingInProviderId, "google");
  await pageShow(true);
  assert.equal(guard().signingInProviderId, null);
  assert.equal(guard().stalled, false);
});

test("a page hidden and shown again still reports the stall", async (t) => {
  const { guard, begin, render, wait } = await renderGuard(t);
  await begin("google");
  await render("hidden");
  await wait(stallMs * 3);
  await render("visible");
  await wait(stallMs / 4);
  assert.equal(guard().stalled, true);
});
