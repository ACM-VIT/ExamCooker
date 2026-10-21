import assert from "node:assert/strict";
import test from "node:test";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import { withRegionalOnlyDataCache } from "./regional-data-cache";

type Store = Parameters<typeof withRegionalOnlyDataCache>[0];

function remoteStore() {
  const calls: string[] = [];
  const store = {
    name: "r2",
    async get(key: string, cacheType?: string) { calls.push(`get:${cacheType}:${key}`); return { value: { key }, lastModified: 1 }; },
    async set(key: string, _value: unknown, cacheType?: string) { calls.push(`set:${cacheType}:${key}`); },
    async delete(key: string) { calls.push(`delete:${key}`); },
  } as unknown as Store;
  return { store, calls };
}

// A Cache API stand-in honouring Cache-Control max-age against a fake clock.
function installCacheApi(t: test.TestContext) {
  let now = 0;
  const entries = new Map<string, { body: string; expiresAt: number }>();
  const cache = {
    async match(url: string) {
      const entry = entries.get(url);
      return entry && entry.expiresAt > now ? new Response(entry.body) : undefined;
    },
    async put(url: string, response: Response) {
      const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 0);
      entries.set(url, { body: await response.text(), expiresAt: now + maxAge * 1000 });
    },
    async delete(url: string) { return entries.delete(url); },
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", { value: { open: async () => cache }, configurable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  return { advance(ms: number) { now += ms; } };
}

test("use cache entries never touch the remote store; route shells still do", async () => {
  const { store, calls } = remoteStore();
  const cache = withRegionalOnlyDataCache(store);
  assert.equal(await cache.get("data", "composable"), null);
  await cache.set("data", {} as never, "composable");
  assert.deepEqual(calls, []);
  assert.notEqual(await cache.get("/route", "cache"), null);
  await cache.set("/route", {} as never, "cache");
  assert.deepEqual(calls, ["get:cache:/route", "set:cache:/route"]);
});

test("the regional cache keeps the only copy of a data entry until it expires", async (t) => {
  const clock = installCacheApi(t);
  const { store, calls } = remoteStore();
  const cache = withRegionalCache(withRegionalOnlyDataCache(store), { mode: "long-lived", bypassTagCacheOnCacheHit: false });
  const entry = { value: "rows", tags: ["past_papers"], stale: 60, timestamp: 0, expire: 3600, revalidate: 300 };
  await cache.set("paper-detail", entry as never, "composable");
  const hit = await cache.get("paper-detail", "composable");
  assert.equal((hit?.value as typeof entry | undefined)?.value, "rows", "read back from the regional cache");
  clock.advance(299_000);
  assert.notEqual(await cache.get("paper-detail", "composable"), null);
  clock.advance(2_000);
  assert.equal(await cache.get("paper-detail", "composable"), null, "expired after revalidate seconds; recompute from Hyperdrive");
  assert.deepEqual(calls, [], "R2 was never read or written for the data entry");
});
