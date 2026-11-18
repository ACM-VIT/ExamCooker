import assert from "node:assert/strict";
import { test } from "node:test";
import { createDoubleTapGuard } from "./native-course-search";

function setup() {
  let time = 0;
  const guard = createDoubleTapGuard("duplicate", () => time);
  const presentations: Array<PromiseWithResolvers<string>> = [];
  const present = () =>
    guard(() => {
      const presentation = Promise.withResolvers<string>();
      presentations.push(presentation);
      return presentation.promise;
    });
  return {
    present,
    presentations,
    advance(ms: number) {
      time += ms;
    },
  };
}

// Lets the guard's settlement handlers run.
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("a second tap while the first presentation is opening is a duplicate", async () => {
  const { present, presentations, advance } = setup();
  const first = present();
  advance(300);
  const second = present();
  assert.equal(presentations.length, 1);
  assert.equal(await second, "duplicate");

  presentations[0].resolve("selected");
  assert.equal(await first, "selected");
});

test("a new search may start as soon as the previous one settles", async () => {
  const { present, presentations, advance } = setup();
  void present();
  advance(300);
  presentations[0].resolve("cancelled");
  await flush();

  advance(300);
  void present();
  assert.equal(presentations.length, 2, "the tap inside the window still opens search");

  presentations[1].reject(new Error("closed"));
  await flush();
  void present();
  assert.equal(presentations.length, 3, "a rejected presentation also settles");
});

test("a tap after the window reaches the native side even if one is pending", async () => {
  const { present, presentations, advance } = setup();
  void present();
  advance(1000);
  void present();
  assert.equal(presentations.length, 2);

  // The older presentation settling must not clear the newer marker.
  presentations[0].resolve("late");
  await flush();
  advance(100);
  const third = present();
  assert.equal(presentations.length, 2);
  assert.equal(await third, "duplicate");
});

test("the window is measured on the monotonic clock, not the wall clock", async (t) => {
  let monotonic = 0;
  t.mock.method(performance, "now", () => monotonic);
  const guard = createDoubleTapGuard("duplicate");
  let starts = 0;
  const pending = () => {
    starts++;
    return new Promise<string>(() => {});
  };

  void guard(pending);
  monotonic += 999;
  const second = guard(pending);
  assert.equal(starts, 1);
  assert.equal(await second, "duplicate");
  monotonic += 1;
  void guard(pending);
  assert.equal(starts, 2, "the window ends after one monotonic second");
});
