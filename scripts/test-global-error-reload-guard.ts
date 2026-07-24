import assert from "node:assert/strict";
import {
  claimChunkReload,
  clearReloadGuard,
  getChunkErrorKey,
  getHydrationRecoveryInitScript,
  getHydrationRecoveryKey,
  hasFreshReloadGuard,
  isChunkLoadError,
  RELOAD_FLAG,
} from "../app/global-error-reload-guard";

type SessionStorageStub = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ErrorListener = (event: { error?: unknown; message?: string }) => void;

function installWindow(sessionStorage: SessionStorageStub) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage },
  });
}

function installHydrationScriptWindow(sessionStorage: SessionStorageStub) {
  const errorListeners: ErrorListener[] = [];
  let reloadCount = 0;
  const location = {
    pathname: "/past-papers",
    reload() {
      reloadCount += 1;
    },
    search: "?paper=1",
  };
  const windowStub = {
    addEventListener(type: string, listener: ErrorListener) {
      if (type === "error") {
        errorListeners.push(listener);
      }
    },
    location,
    sessionStorage,
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowStub,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: sessionStorage,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: location,
  });

  return {
    dispatchError(error: Error & { digest?: string }) {
      for (const listener of errorListeners) {
        listener({ error, message: error.message });
      }
    },
    getReloadCount() {
      return reloadCount;
    },
  };
}

function createMemoryStorage(initialEntries: Record<string, string> = {}): SessionStorageStub {
  const entries = new Map(Object.entries(initialEntries));
  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    },
  };
}

function createThrowingStorage(): SessionStorageStub {
  return {
    getItem() {
      throw new Error("sessionStorage unavailable");
    },
    setItem() {
      throw new Error("sessionStorage unavailable");
    },
    removeItem() {
      throw new Error("sessionStorage unavailable");
    },
  };
}

const realDateNow = Date.now;

try {
  const now = 1_000_000;
  Date.now = () => now;

  const chunkError = new Error("Loading chunk app-pages-browser failed");
  chunkError.name = "ChunkLoadError";
  const key = getChunkErrorKey(chunkError);

  assert.equal(isChunkLoadError(chunkError), true);
  assert.equal(isChunkLoadError(new Error("ordinary failure")), false);

  installWindow(createMemoryStorage());
  assert.equal(claimChunkReload(key), true, "first chunk error claims a guarded reload");
  assert.equal(hasFreshReloadGuard(key), true, "claim writes a fresh reload guard");
  assert.equal(claimChunkReload(key), false, "fresh guard blocks repeated reloads");

  installWindow(createMemoryStorage({
    [RELOAD_FLAG]: JSON.stringify({ key, timestamp: now - 60_001 }),
  }));
  assert.equal(claimChunkReload(key), true, "stale guard allows a later reload");

  installWindow(createThrowingStorage());
  assert.equal(
    claimChunkReload(key),
    false,
    "storage failures must not trigger an unguarded reload loop",
  );
  clearReloadGuard();

  const hydrationError = new Error("Minified React error #418; hydration failed");
  const hydrationKey = getHydrationRecoveryKey(hydrationError);
  const storage = createMemoryStorage({
    [RELOAD_FLAG]: JSON.stringify({ key: hydrationKey, timestamp: now }),
  });
  const hydrationHarness = installHydrationScriptWindow(storage);
  eval(getHydrationRecoveryInitScript());
  hydrationHarness.dispatchError(hydrationError);

  assert.equal(
    hydrationHarness.getReloadCount(),
    0,
    "inline hydration recovery must honor the same guard key as global-error",
  );

  const secondHydrationError = new Error("Minified React error #419; hydration failed");
  hydrationHarness.dispatchError(secondHydrationError);

  assert.equal(
    hydrationHarness.getReloadCount(),
    1,
    "handling one hydration signature must not disable recovery for another",
  );

  console.log("global error reload guard tests passed");
} finally {
  Date.now = realDateNow;
}
