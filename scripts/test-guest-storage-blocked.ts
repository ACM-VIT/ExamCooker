import assert from "node:assert/strict";
import { loadGuestRecentViews, recordGuestRecentView } from "../lib/guest-storage";
import { readLocalStorage, writeLocalStorage } from "../lib/safe-storage";

let dispatched = 0;

function installWindow(localStorage: () => Storage) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        return localStorage();
      },
      dispatchEvent() {
        dispatched += 1;
        return true;
      },
    },
  });
}

installWindow(() => {
  throw new DOMException("The operation is insecure.", "SecurityError");
});

assert.equal(readLocalStorage("key"), null);
assert.equal(writeLocalStorage("key", "value"), false);
assert.deepEqual(loadGuestRecentViews(), []);
assert.doesNotThrow(() => recordGuestRecentView({ id: "1", type: "pastpaper", title: "Paper" }));
assert.equal(dispatched, 0);

const entries = new Map<string, string>();
installWindow(
  () =>
    ({
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
    }) as Storage,
);

recordGuestRecentView({ id: "1", type: "pastpaper", title: "Paper" });
assert.equal(dispatched, 1);
assert.deepEqual(
  loadGuestRecentViews().map((item) => item.id),
  ["1"],
);

console.log("guest storage blocked-storage tests passed");
