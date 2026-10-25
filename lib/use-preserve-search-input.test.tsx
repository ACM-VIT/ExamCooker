import assert from "node:assert/strict";
import test from "node:test";
import { act, StrictMode, useRef, useState } from "react";
import { hydrationFixture } from "./testing/react-hydration";
import { usePreserveSearchInput } from "./use-preserve-search-input";

function Search({ initial = "", dropdown = false }: { initial?: string; dropdown?: boolean }) {
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  usePreserveSearchInput(inputRef, setQuery, dropdown ? setOpen : undefined);
  return (
    <section>
      <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} />
      <output>{query ? `Results for ${query}` : "All results"}</output>
      {query && <button onClick={() => setQuery("")}>Clear</button>}
      {open && <p>Suggestions</p>}
    </section>
  );
}

test("early typing updates controlled state and filtered content without hydration recovery", async (t) => {
  const fixture = hydrationFixture(t, <StrictMode><Search dropdown /></StrictMode>);
  const input = fixture.container.querySelector("input")!;
  input.value = "calculus";
  input.focus();
  await fixture.hydrate();
  assert.equal(input.value, "calculus");
  assert.equal(fixture.container.querySelector("output")?.textContent, "Results for calculus");
  assert.equal(fixture.container.querySelector("p")?.textContent, "Suggestions");
  assert.deepEqual(fixture.errors, []);
  await act(async () => fixture.container.querySelector("button")!.click());
  assert.equal(input.value, "");
  assert.equal(fixture.container.querySelector("output")?.textContent, "All results");
});

test("clearing a server-provided query before hydration keeps it cleared", async (t) => {
  const fixture = hydrationFixture(t, <Search initial="physics" />);
  const input = fixture.container.querySelector("input")!;
  input.value = "";
  await fixture.hydrate();
  assert.equal(input.value, "");
  assert.equal(fixture.container.querySelector("output")?.textContent, "All results");
  assert.deepEqual(fixture.errors, []);
});

test("multiple searches adopt only their own field and keep unfocused dropdowns closed", async (t) => {
  const fixture = hydrationFixture(t, <><Search dropdown /><Search dropdown /></>);
  const inputs = fixture.container.querySelectorAll("input");
  inputs[0].value = "chemistry";
  inputs[1].value = "math";
  await fixture.hydrate();
  assert.deepEqual(Array.from(inputs, (input) => input.value), ["chemistry", "math"]);
  assert.deepEqual(Array.from(fixture.container.querySelectorAll("output"), (node) => node.textContent), [
    "Results for chemistry", "Results for math",
  ]);
  assert.equal(fixture.container.querySelector("p"), null);
  assert.deepEqual(fixture.errors, []);
});

test("untouched inputs keep the server default", async (t) => {
  const fixture = hydrationFixture(t, <Search initial="physics" />);
  await fixture.hydrate();
  assert.equal(fixture.container.querySelector("input")?.value, "physics");
  assert.deepEqual(fixture.errors, []);
});
