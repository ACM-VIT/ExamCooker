import assert from "node:assert/strict";
import {
  claimChunkReload,
  clearReloadGuard,
  getChunkErrorKey,
  getHydrationRecoveryKey,
  hasFreshReloadGuard,
  isChunkLoadError,
  isHydrationError,
} from "../app/global-error-reload-guard";

const RELOAD_FLAG = "examcooker:chunk-reload";

type SessionStorageStub = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function installWindow(sessionStorage: SessionStorageStub) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage },
  });
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

  const hydrationError = new Error("Minified React error #418");
  const hydrationErrorWithDigest = Object.assign(
    new Error("Minified React error #418"),
    { digest: "NEXT_BOUNDARY_DIGEST" },
  );
  const hydrationKey = getHydrationRecoveryKey(hydrationError);

  assert.equal(isHydrationError(hydrationError), true);
  assert.equal(
    getHydrationRecoveryKey(hydrationErrorWithDigest),
    hydrationKey,
    "hydration reload keys must not depend on boundary-only digests",
  );

  installWindow(createMemoryStorage({
    [RELOAD_FLAG]: JSON.stringify({ key: hydrationKey, timestamp: now }),
  }));
  assert.equal(
    claimChunkReload(getHydrationRecoveryKey(hydrationErrorWithDigest)),
    false,
    "a pre-hydration guard blocks a later global-error hydration reload",
  );

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

  console.log("global error reload guard tests passed");
} finally {
  Date.now = realDateNow;
}
