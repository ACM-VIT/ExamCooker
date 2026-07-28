import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  claimChunkReload,
  clearReloadGuard,
  getChunkErrorKey,
  getRecoveryKey,
  hasFreshReloadGuard,
  isChunkLoadError,
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
  assert.equal(
    getRecoveryKey(new Error("Minified React error #418"), "hydration"),
    "hydration:Error:Minified React error #418:",
    "hydration recovery keys include the trailing digest field used by the inline guard",
  );
  assert.match(
    readFileSync(new URL("../app/hydration-recovery-script.ts", import.meta.url), "utf8"),
    /\+':'\+\(\(err&&err\.digest\)\|\|''\)/,
    "the pre-hydration inline guard must use the same digest-aware key shape",
  );

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

  console.log("global error reload guard tests passed");
} finally {
  Date.now = realDateNow;
}
