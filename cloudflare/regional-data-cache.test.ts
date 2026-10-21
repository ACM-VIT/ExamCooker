import assert from "node:assert/strict";
import test from "node:test";
import { withRegionalOnlyDataCache } from "./regional-data-cache";

test("use cache entries never touch the remote store; route shells still do", async () => {
  const calls: string[] = [];
  const store = {
    name: "r2",
    async get(key: string, cacheType?: string) { calls.push(`get:${cacheType}:${key}`); return { value: { key }, lastModified: 1 }; },
    async set(key: string, _value: unknown, cacheType?: string) { calls.push(`set:${cacheType}:${key}`); },
    async delete(key: string) { calls.push(`delete:${key}`); },
  } as unknown as Parameters<typeof withRegionalOnlyDataCache>[0];
  const cache = withRegionalOnlyDataCache(store);
  assert.equal(await cache.get("data", "composable"), null);
  await cache.set("data", {} as never, "composable");
  assert.deepEqual(calls, []);
  assert.notEqual(await cache.get("/route", "cache"), null);
  await cache.set("/route", {} as never, "cache");
  assert.deepEqual(calls, ["get:cache:/route", "set:cache:/route"]);
});
