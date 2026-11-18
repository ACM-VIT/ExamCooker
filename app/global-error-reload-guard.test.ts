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

function claimAll(
  claims: Array<string | [pathname: string, key: string]>,
  start: ReloadGuard = {},
  now = 1_000,
) {
  let guard = start;
  return claims.map((entry) => {
    const [pathname, key] = typeof entry === "string" ? ["/paper", entry] : entry;
    const claim = claimReloadInGuard(guard, key, now, pathname);
    guard = claim.guard;
    return claim.allowed;
  });
}

test("each error key reloads once per window", () => {
  assert.deepEqual(claimAll(["chunk:A", "chunk:A"]), [true, false]);
});

test("errors that alternate between reloads of a page stop at its cap", () => {
  const outcomes = claimAll(["chunk:A", "hydration:B", "chunk:A", "hydration:C"]);
  assert.equal(outcomes.filter(Boolean).length, MAX_RECOVERY_RELOADS);
  assert.deepEqual(outcomes, [true, true, false, false]);
});

test("a page that used its reloads does not block recovery on another page", () => {
  const outcomes = claimAll([
    ["/paper/one", "hydration:A"],
    ["/paper/one", "hydration:B"],
    ["/paper/one", "hydration:C"],
    ["/paper/two", "hydration:A"],
    // "/paper" is a prefix of the other paths but a different page.
    ["/paper", "hydration:A"],
  ]);
  assert.deepEqual(outcomes, [true, true, false, true, true]);
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

// Runs the pre-hydration script against `storage`; each run is a fresh page
// load in which the script installs one error listener.
function scriptPageLoads(storage: Map<string, string>) {
  const page = {
    reloads: 0,
    run(message: string, pathname = "/paper") {
      const listeners: Array<(event: unknown) => void> = [];
      runInNewContext(hydrationRecoveryInitScript, {
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
        location: { pathname, reload: () => { page.reloads++; } },
        window: { addEventListener: (_type: string, handler: (event: unknown) => void) => listeners.push(handler) },
        Date,
        JSON,
        Object,
      });
      assert.equal(listeners.length, 1);
      listeners[0]({ error: { name: "Error", message } });
    },
  };
  return page;
}

const PAPER_418_KEY = "hydration:/paper:Error:Minified React error #418:";

test("a fresh claim in the old single-record format still blocks its key", () => {
  const now = 10 * RELOAD_GUARD_TTL_MS;
  const legacy = (timestamp: number) =>
    JSON.stringify({ key: PAPER_418_KEY, timestamp });

  const guard = parseReloadGuard(legacy(now - 1), now);
  assert.equal(claimReloadInGuard(guard, PAPER_418_KEY, now, "/paper").allowed, false);
  assert.equal(claimReloadInGuard(guard, "chunk:new", now, "/paper").allowed, true);
  const expired = parseReloadGuard(legacy(now - RELOAD_GUARD_TTL_MS), now);
  assert.equal(claimReloadInGuard(expired, PAPER_418_KEY, now, "/paper").allowed, true);

  const storage = new Map([[RELOAD_FLAG, legacy(Date.now())]]);
  const page = scriptPageLoads(storage);
  page.run("Minified React error #418");
  assert.equal(page.reloads, 0, "the script honors the legacy claim");
  page.run("Minified React error #419");
  assert.equal(page.reloads, 1, "other mismatches still recover");
  storage.set(RELOAD_FLAG, legacy(Date.now() - RELOAD_GUARD_TTL_MS));
  page.run("Minified React error #418");
  assert.equal(page.reloads, 2, "an expired legacy claim does not block");
});

test("the pre-hydration script follows the same guard", () => {
  const storage = new Map<string, string>();
  const page = scriptPageLoads(storage);
  const run = page.run;

  run("Minified React error #418");
  run("Minified React error #418");
  assert.equal(page.reloads, 1, "the same mismatch reloads once");

  // The script's claims are the ones claimReloadInGuard reads. Check the
  // stored signature while /paper is still under its cap: that mismatch is
  // claimed, and a different error on the page may still reload.
  const afterFirst = JSON.parse(storage.get(RELOAD_FLAG) ?? "{}") as ReloadGuard;
  assert.equal(claimReloadInGuard(afterFirst, PAPER_418_KEY, Date.now(), "/paper").allowed, false);
  assert.equal(claimReloadInGuard(afterFirst, "chunk:new", Date.now(), "/paper").allowed, true);

  run("Minified React error #419");
  run("Minified React error #423");
  assert.equal(page.reloads, MAX_RECOVERY_RELOADS, "different mismatches stop at the cap");
  const stored = JSON.parse(storage.get(RELOAD_FLAG) ?? "{}") as ReloadGuard;
  assert.equal(Object.keys(stored).length, MAX_RECOVERY_RELOADS);

  run("Minified React error #418", "/other-paper");
  assert.equal(page.reloads, MAX_RECOVERY_RELOADS + 1, "another page still recovers");

  // /paper is now at its cap for every key; other pages are not.
  const guard = JSON.parse(storage.get(RELOAD_FLAG) ?? "{}") as ReloadGuard;
  assert.equal(claimReloadInGuard(guard, PAPER_418_KEY, Date.now(), "/paper").allowed, false);
  assert.equal(claimReloadInGuard(guard, "chunk:new", Date.now(), "/paper").allowed, false);
  assert.equal(claimReloadInGuard(guard, "chunk:new", Date.now(), "/third").allowed, true);
});
