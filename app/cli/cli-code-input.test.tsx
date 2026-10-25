import assert from "node:assert/strict";
import test from "node:test";
import { act, StrictMode } from "react";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { hydrationFixture } from "@/lib/testing/react-hydration";
import CliCodeInput from "./cli-code-input";

const router: AppRouterInstance = {
  bfcacheId: "cli-hydration-test",
  back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {},
};

function codeForm(initial = "", onSubmitCode = (_code: string) => {}) {
  return (
    <StrictMode>
      <AppRouterContext.Provider value={router}>
        <CliCodeInput initial={initial} onSubmitCode={onSubmitCode} />
      </AppRouterContext.Provider>
    </StrictMode>
  );
}

test("a code entered before hydration survives mount effects and can be submitted", async (t) => {
  let submitted = "";
  const fixture = hydrationFixture(t, codeForm("", (code) => { submitted = code; }));
  const slots = fixture.container.querySelectorAll<HTMLInputElement>('input[type="text"]');
  Array.from("abcd1234").forEach((char, i) => { slots[i].value = char; });
  slots[4].focus();
  await fixture.hydrate();
  assert.deepEqual(Array.from(slots, (input) => input.value), Array.from("ABCD1234"));
  assert.equal(document.activeElement, slots[4], "hydration must not move focus to the first slot");
  assert.equal(fixture.container.querySelector<HTMLInputElement>('input[name="code"]')?.value, "ABCD-1234");
  const submit = fixture.container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  assert.equal(submit.disabled, false);
  await act(async () => submit.click());
  assert.equal(submitted, "ABCD-1234");
  assert.deepEqual(fixture.errors, []);
});

test("partial early entry survives unrelated renders and clear still works", async (t) => {
  const fixture = hydrationFixture(t, codeForm());
  const slots = fixture.container.querySelectorAll<HTMLInputElement>('input[type="text"]');
  slots[0].value = "A";
  slots[1].value = "B";
  await fixture.hydrate();
  await fixture.render(codeForm());
  assert.equal(slots[0].value, "A");
  assert.equal(slots[1].value, "B");
  const clear = fixture.container.querySelector<HTMLButtonElement>('button[type="button"]')!;
  await act(async () => clear.click());
  assert.ok(Array.from(slots).every((input) => input.value === ""));
  assert.equal(fixture.container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);
  assert.deepEqual(fixture.errors, []);
});

test("a later initial-code change still replaces the code", async (t) => {
  const fixture = hydrationFixture(t, codeForm("ABCD-1234"));
  await fixture.hydrate();
  await fixture.render(codeForm("WXYZ-5678"));
  assert.equal(fixture.container.querySelector<HTMLInputElement>('input[name="code"]')?.value, "WXYZ-5678");
  assert.deepEqual(fixture.errors, []);
});
