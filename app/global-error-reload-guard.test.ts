import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import {
  MAX_RECOVERY_RELOADS,
  RELOAD_FLAG,
  RELOAD_GUARD_TTL_MS,
  claimReloadInGuard,
  parseReloadGuard,
  type ReloadGuard,
} from "./global-error-reload-guard";
import { hydrationRecoveryInitScript } from "./hydration-recovery-script";

function claimAll(keys: string[], start: ReloadGuard = {}, now = 1_000) {
  let guard = start;
  return keys.map((key) => {
    const claim = claimReloadInGuard(guard, key, now);
    guard = claim.guard;
    return claim.allowed;
  });
}

test("each error key reloads once per window", () => {
  assert.deepEqual(claimAll(["chunk:A", "chunk:A"]), [true, false]);
});

test("errors that alternate between reloads stop after the overall cap", () => {
  const outcomes = claimAll(["chunk:A", "hydration:B", "chunk:A", "hydration:C"]);
  assert.equal(outcomes.filter(Boolean).length, MAX_RECOVERY_RELOADS);
  assert.deepEqual(outcomes, [true, true, false, false]);
});

test("claims expire after the window and the old single-record format is read", () => {
  const now = 10 * RELOAD_GUARD_TTL_MS;
  assert.deepEqual(parseReloadGuard(JSON.stringify({ old: now - RELOAD_GUARD_TTL_MS }), now), {});
  assert.deepEqual(
    parseReloadGuard(JSON.stringify({ key: "chunk:A", timestamp: now - 1 }), now),
    { "chunk:A": now - 1 },
  );
  assert.deepEqual(parseReloadGuard("not json", now), {});
});

test("the pre-hydration script follows the same guard", () => {
  const storage = new Map<string, string>();
  let reloads = 0;
  // Each run is a fresh page load: the script installs one error listener.
  const run = (message: string) => {
    const listeners: Array<(event: unknown) => void> = [];
    runInNewContext(hydrationRecoveryInitScript, {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      location: { pathname: "/paper", reload: () => { reloads++; } },
      window: { addEventListener: (_type: string, handler: (event: unknown) => void) => listeners.push(handler) },
      Date,
      JSON,
      Object,
    });
    assert.equal(listeners.length, 1);
    listeners[0]({ error: { name: "Error", message } });
  };

  run("Minified React error #418");
  run("Minified React error #418");
  assert.equal(reloads, 1, "the same mismatch reloads once");

  run("Minified React error #419");
  run("Minified React error #423");
  assert.equal(reloads, MAX_RECOVERY_RELOADS, "different mismatches stop at the cap");
  assert.equal(Object.keys(JSON.parse(storage.get(RELOAD_FLAG) ?? "{}")).length, MAX_RECOVERY_RELOADS);
});
