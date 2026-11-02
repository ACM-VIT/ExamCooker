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
