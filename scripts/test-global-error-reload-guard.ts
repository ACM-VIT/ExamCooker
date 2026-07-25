import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  claimChunkReload,
  clearReloadGuard,
  getChunkErrorKey,
  getRecoveryKey,
  hasFreshReloadGuard,
  HYDRATION_RECOVERY_KEY_PREFIX,
  isChunkLoadError,
} from "../app/global-error-reload-guard";

const RELOAD_FLAG = "examcooker:chunk-reload";
const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.slice(0, __filename.lastIndexOf("/"));

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

  installWindow(createMemoryStorage({
    [RELOAD_FLAG]: JSON.stringify({ key, timestamp: now - 60_001 }),
  }));
  assert.equal(claimChunkReload(key), true, "stale guard allows a later reload");

  const hydrationError = Object.assign(
    new Error("Minified React error #418; visit https://react.dev/errors/418"),
    {
      digest: "hydration-digest",
      name: "Error",
    },
  );
  const hydrationKey = getRecoveryKey(
    hydrationError,
    HYDRATION_RECOVERY_KEY_PREFIX,
  );

  installWindow(createMemoryStorage({
    [RELOAD_FLAG]: JSON.stringify({ key: hydrationKey, timestamp: now }),
  }));
  assert.equal(
    claimChunkReload(hydrationKey),
    false,
    "early hydration recovery guard must block the fatal boundary path",
  );

  const layoutSource = readFileSync(`${__dirname}/../app/layout.tsx`, "utf8");
  assert.match(
    layoutSource,
    /HYDRATION_RECOVERY_KEY_PREFIX/,
    "inline hydration script must use the shared hydration key prefix",
  );
  assert.match(
    layoutSource,
    /var key=PREFIX\+'\:'\+\(\(err&&err\.name\)\|\|'Error'\)\+'\:'\+msg\+'\:'\+digest/,
    "inline hydration script key must include the digest segment used by getRecoveryKey",
  );

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
