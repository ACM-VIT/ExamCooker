import type { TestContext } from "node:test";
import { Window } from "happy-dom";
import { act, type ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

/** Render HTML first so tests can edit real controls before React takes over. */
export function hydrationFixture(t: TestContext, element: ReactNode) {
  const html = renderToString(element);
  const window = new Window({ url: "http://localhost/" });
  const globals = {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLIFrameElement: window.HTMLIFrameElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const document = window.document as unknown as Document;
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = html;
  const errors: unknown[] = [];
  let root: Root | undefined;
  t.after(async () => {
    await act(async () => root?.unmount());
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  });
  return {
    container,
    errors,
    async hydrate() {
      await act(async () => {
        root = hydrateRoot(container, element, { onRecoverableError: (error) => errors.push(error) });
      });
    },
    async render(next: ReactNode) {
      await act(async () => root!.render(next));
    },
  };
}
