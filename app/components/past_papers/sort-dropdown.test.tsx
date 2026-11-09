import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { act, StrictMode } from "react";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { hydrationFixture } from "@/lib/testing/react-hydration";
import SortDropdown from "@/app/components/past_papers/sort-dropdown";

type SortValue = React.ComponentProps<typeof SortDropdown>["value"];

async function setup(t: TestContext, value: SortValue = "seasonal", searchString = "") {
  const navigations: string[] = [];
  const router: AppRouterInstance = {
    bfcacheId: "sort-dropdown-test",
    back() {}, forward() {}, refresh() {}, push() {}, prefetch() {},
    replace(url) { navigations.push(url); },
  };
  function dropdown(nextValue: SortValue) {
    return (
      <StrictMode>
        <AppRouterContext.Provider value={router}>
          <SortDropdown basePath="/past_papers/BMAT201L" value={nextValue} searchString={searchString} />
        </AppRouterContext.Provider>
      </StrictMode>
    );
  }
  const fixture = hydrationFixture(t, dropdown(value));
  await fixture.hydrate();
  const trigger = fixture.container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  await act(async () => trigger.focus());
  const options = () => Array.from(fixture.container.querySelectorAll<HTMLElement>('[role="option"]'));
  return {
    ...fixture,
    trigger,
    navigations,
    options,
    activeOption: () => document.getElementById(trigger.getAttribute("aria-activedescendant") ?? ""),
    async key(key: string) {
      const event = new document.defaultView!.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      await act(async () => { trigger.dispatchEvent(event); });
      return event;
    },
    async open() { await act(async () => trigger.click()); },
    async choose(index: number) { await act(async () => options()[index].click()); },
    async update(nextValue: SortValue) { await fixture.render(dropdown(nextValue)); },
  };
}

// happy-dom has no layout engine. Model a 154px menu with four 36px rows so
// placement and keyboard scrolling can be exercised with constrained geometry.
function mockLayout(t: TestContext, trigger: HTMLButtonElement, top: number, height: number) {
  const view = document.defaultView!;
  const geometry = { top, height };
  Object.defineProperty(view, "innerHeight", { configurable: true, get: () => geometry.height });
  trigger.getBoundingClientRect = () => new view.DOMRect(40, geometry.top, 150, 26);
  const originals: Array<[object, string, PropertyDescriptor | undefined]> = [];
  function define(target: object, name: string, descriptor: PropertyDescriptor) {
    originals.push([target, name, Object.getOwnPropertyDescriptor(target, name)]);
    Object.defineProperty(target, name, { configurable: true, ...descriptor });
  }
  const menuHeight = (menu: HTMLUListElement) => Math.min(154, Number.parseFloat(menu.style.maxHeight) || 154);
  const menuPrototype = view.HTMLUListElement.prototype;
  define(menuPrototype, "scrollHeight", { get: () => 152 });
  define(menuPrototype, "offsetHeight", { get(this: HTMLUListElement) { return menuHeight(this); } });
  define(menuPrototype, "clientHeight", { get(this: HTMLUListElement) { return menuHeight(this) - 2; } });
  define(menuPrototype, "clientTop", { get: () => 1 });
  define(menuPrototype, "getBoundingClientRect", {
    value(this: HTMLUListElement) {
      const height = menuHeight(this);
      const top = this.dataset.side === "top" ? geometry.top - 4 - height : geometry.top + 26 + 4;
      return new view.DOMRect(40, top, 160, height);
    },
  });
  define(view.HTMLLIElement.prototype, "getBoundingClientRect", {
    value(this: HTMLLIElement) {
      const menu = this.parentElement as HTMLUListElement;
      const index = Array.from(menu.children).indexOf(this);
      return new view.DOMRect(45, menu.getBoundingClientRect().top + 5 + index * 36 - menu.scrollTop, 150, 36);
    },
  });
  t.after(() => {
    for (const [target, name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else Reflect.deleteProperty(target, name);
    }
  });
  return geometry;
}

function assertActiveVisible(fixture: Awaited<ReturnType<typeof setup>>) {
  const menu = fixture.container.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const bounds = menu.getBoundingClientRect();
  const option = fixture.activeOption()!.getBoundingClientRect();
  assert.ok(option.top >= bounds.top + menu.clientTop, "active option must not be clipped at the top");
  assert.ok(option.bottom <= bounds.top + menu.clientTop + menu.clientHeight, "active option must not be clipped at the bottom");
  assert.equal(document.activeElement, fixture.trigger);
}

test("hydrates a labelled combobox and opens the selected option", async (t) => {
  const fixture = await setup(t, "year_asc");
  assert.deepEqual(fixture.errors, []);
  assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
  assert.equal(document.getElementById(fixture.trigger.getAttribute("aria-labelledby")!)?.textContent?.trim(), "Sort");
  await fixture.open();
  assert.equal(fixture.options().length, 4);
  assert.equal(fixture.activeOption(), fixture.options()[2]);
  assert.equal(fixture.options()[2].getAttribute("aria-selected"), "true");
  assert.equal(document.activeElement, fixture.trigger);
});

for (const [index, sort] of [[1, "year_desc"], [2, "year_asc"], [3, "recent"]] as const) {
  test(`selecting ${sort} preserves filters and resets pagination`, async (t) => {
    const fixture = await setup(t, "seasonal", "exam=cat-1&year=2025&slot=A1&slot=B2&answer_key=1&page=3");
    await fixture.open();
    await fixture.choose(index);
    assert.equal(fixture.navigations.length, 1);
    const url = new URL(fixture.navigations[0], "http://localhost");
    assert.equal(url.pathname, "/past_papers/BMAT201L");
    assert.equal(url.searchParams.get("sort"), sort);
    assert.equal(url.searchParams.has("page"), false);
    assert.equal(url.searchParams.get("exam"), "cat-1");
    assert.equal(url.searchParams.get("year"), "2025");
    assert.deepEqual(url.searchParams.getAll("slot"), ["A1", "B2"]);
    assert.equal(url.searchParams.get("answer_key"), "1");
    assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
    assert.equal(document.activeElement, fixture.trigger);
  });
}

test("current exam first removes explicit sorting and handles an empty query", async (t) => {
  const fixture = await setup(t, "recent", "sort=recent&page=2");
  await fixture.open();
  await fixture.choose(0);
  assert.deepEqual(fixture.navigations, ["/past_papers/BMAT201L"]);
  await fixture.update("seasonal");
  assert.match(fixture.trigger.textContent!, /Current exam first/);
  await fixture.open();
  await fixture.choose(0);
  assert.equal(fixture.navigations.length, 1, "choosing the current sort must not navigate again");
});

test("arrow keys, Home and End move the active option before Enter commits", async (t) => {
  const fixture = await setup(t);
  await fixture.key("ArrowDown");
  assert.equal(fixture.activeOption(), fixture.options()[0]);
  await fixture.key("ArrowUp");
  assert.equal(fixture.activeOption(), fixture.options()[3]);
  await fixture.key("ArrowDown");
  assert.equal(fixture.activeOption(), fixture.options()[0]);
  await fixture.key("End");
  assert.equal(fixture.activeOption(), fixture.options()[3]);
  await fixture.key("Home");
  await fixture.key("ArrowDown");
  assert.deepEqual(fixture.navigations, [], "highlighting options must not change sorting");
  await fixture.key("Enter");
  assert.deepEqual(fixture.navigations, ["/past_papers/BMAT201L?sort=year_desc"]);
});

test("typeahead opens the menu, cycles matching labels and Space commits", async (t) => {
  const fixture = await setup(t);
  await fixture.key("y");
  assert.equal(fixture.activeOption(), fixture.options()[1]);
  await fixture.key("y");
  assert.equal(fixture.activeOption(), fixture.options()[2]);
  await fixture.key("Escape");
  await fixture.key("r");
  await fixture.key("e");
  assert.equal(fixture.activeOption(), fixture.options()[3]);
  await fixture.key(" ");
  assert.deepEqual(fixture.navigations, ["/past_papers/BMAT201L?sort=recent"]);
});

test("Escape, Tab, focus leaving and outside pointer presses dismiss without navigating", async (t) => {
  const fixture = await setup(t);
  await fixture.key(" ");
  await fixture.key("End");
  await fixture.key("Escape");
  assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, fixture.trigger);
  await fixture.open();
  assert.equal(fixture.activeOption(), fixture.options()[0], "reopening resets the active option");
  const tab = await fixture.key("Tab");
  assert.equal(tab.defaultPrevented, false, "normal tab navigation must remain available");
  assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
  await fixture.open();
  const outside = document.createElement("button");
  document.body.append(outside);
  await act(async () => outside.focus());
  assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
  await fixture.open();
  await act(async () => {
    outside.dispatchEvent(new document.defaultView!.PointerEvent("pointerdown", { bubbles: true }));
  });
  assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
  assert.deepEqual(fixture.navigations, []);
});

test("the popup opens above a trigger near the viewport bottom", async (t) => {
  const fixture = await setup(t);
  mockLayout(t, fixture.trigger, 180, 220);
  await fixture.open();
  const menu = fixture.container.querySelector<HTMLUListElement>('[role="listbox"]')!;
  assert.equal(menu.dataset.side, "top");
  assert.ok(menu.getBoundingClientRect().top >= 8);
  assert.ok(menu.getBoundingClientRect().bottom < fixture.trigger.getBoundingClientRect().top);
  assertActiveVisible(fixture);
});

test("the popup opens below when all choices fit there", async (t) => {
  const fixture = await setup(t);
  mockLayout(t, fixture.trigger, 100, 500);
  await fixture.open();
  const menu = fixture.container.querySelector<HTMLUListElement>('[role="listbox"]')!;
  assert.equal(menu.dataset.side, "bottom");
  assert.ok(menu.getBoundingClientRect().top > fixture.trigger.getBoundingClientRect().bottom);
  assert.ok(menu.getBoundingClientRect().bottom <= 492);
});

test("a constrained popup scrolls to the active choice for End, Home, arrows and typeahead", async (t) => {
  const fixture = await setup(t);
  mockLayout(t, fixture.trigger, 82, 200);
  await fixture.open();
  const menu = fixture.container.querySelector<HTMLUListElement>('[role="listbox"]')!;
  assert.equal(menu.dataset.side, "bottom");
  assert.equal(menu.style.maxHeight, "80px");
  assert.ok(menu.getBoundingClientRect().bottom <= 192);
  await fixture.key("End");
  assert.ok(menu.scrollTop > 0);
  assertActiveVisible(fixture);
  await fixture.key("Home");
  assertActiveVisible(fixture);
  await fixture.key("ArrowUp");
  assertActiveVisible(fixture);
  await fixture.key("ArrowDown");
  assertActiveVisible(fixture);
  await fixture.key("r");
  assertActiveVisible(fixture);
  assert.equal(document.defaultView!.scrollY, 0, "revealing an option must not scroll the page");
  assert.deepEqual(fixture.navigations, []);
});

test("an open popup refits and keeps its active choice visible after resizing and scrolling", async (t) => {
  const fixture = await setup(t, "recent");
  const geometry = mockLayout(t, fixture.trigger, 82, 500);
  await fixture.open();
  geometry.height = 200;
  await act(async () => { window.dispatchEvent(new document.defaultView!.Event("resize")); });
  const menu = fixture.container.querySelector<HTMLUListElement>('[role="listbox"]')!;
  assert.equal(menu.style.maxHeight, "80px");
  assertActiveVisible(fixture);
  geometry.top = 165;
  geometry.height = 220;
  await act(async () => { window.dispatchEvent(new document.defaultView!.Event("scroll")); });
  assert.equal(menu.dataset.side, "top");
  assert.ok(menu.getBoundingClientRect().top >= 8);
  assertActiveVisible(fixture);
  await fixture.key("Escape");
  await act(async () => { window.dispatchEvent(new document.defaultView!.Event("resize")); });
  assert.equal(fixture.trigger.getAttribute("aria-expanded"), "false");
});

test("popup placement respects the visual viewport's height and offset when zoomed", async (t) => {
  const fixture = await setup(t, "recent");
  mockLayout(t, fixture.trigger, 350, 600);
  const viewport = Object.assign(new document.defaultView!.EventTarget(), { offsetTop: 200, height: 200 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  await fixture.open();
  const menu = fixture.container.querySelector<HTMLUListElement>('[role="listbox"]')!;
  assert.equal(menu.dataset.side, "top");
  assert.equal(menu.style.maxHeight, "138px");
  assert.ok(menu.getBoundingClientRect().top >= viewport.offsetTop + 8);
  assertActiveVisible(fixture);
  viewport.height = 300;
  viewport.offsetTop = 250;
  await act(async () => { viewport.dispatchEvent(new document.defaultView!.Event("resize")); });
  assert.equal(menu.dataset.side, "bottom");
  assert.ok(menu.getBoundingClientRect().bottom <= viewport.offsetTop + viewport.height - 8);
  assertActiveVisible(fixture);
});
