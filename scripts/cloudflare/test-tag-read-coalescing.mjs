import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { AsyncLocalStorage } from "node:async_hooks";
  import tagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";
  import { withPublicRouteTagPrefetch } from "./cloudflare/public-route-tag-prefetch.ts";
  import { recordPublicRequestPath, publicRouteTags } from "./cloudflare/public-route-tags.ts";
  const als = new AsyncLocalStorage();
  globalThis.__openNextAls = als;
  Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => als.getStore() });
  globalThis.openNextConfig = {};
  const adapter = tagCache({ baseShardSize: 4, regionalCache: false });
  globalThis.tagCache = adapter;
  const incremental = withPublicRouteTagPrefetch({ name: "fixture", async get() {
    return { value: {}, lastModified: 1 };
  }, async set() {}, async delete() {} });
  export default { async fetch(request, env, nativeCtx) {
    const input = await request.json();
    const path = "/past_papers/BCSE203E/paper/e39aab7d-9607-406e-a9f1-8a7c5bed4b31";
    const tags = publicRouteTags(path);
    const soft = tags.filter(tag => tag.startsWith("_N_T_/"));
    const hard = tags.filter(tag => !tag.startsWith("_N_T_/"));
    const reads = {}, namespaces = new Map(), retained = [];
    let releaseHard, failures = input.fail ? 1 : 0;
    const gate = new Promise(resolve => releaseHard = resolve);
    const ctx = { waitUntil(promise) { retained.push(promise); nativeCtx.waitUntil(promise); } };
    const state = { ctx, env: { NEXT_TAG_CACHE_DO_SHARDED: {
      idFromName: name => name,
      get: () => ({ async getTagData(requested) {
        for (const tag of requested) reads[tag] = (reads[tag] ?? 0) + 1;
        if (input.fail && failures-- > 0) throw new Error("expected transient tag read failure");
        if (input.gate && requested.some(tag => hard.includes(tag))) await gate;
        return Object.fromEntries(requested.map(tag => [tag, tag === "missing" ? null : {
          revalidatedAt: input.timestamp, stale: input.timestamp, expire: null,
        }]));
      } })
    } }, requestCache: { getOrCreate(key) {
      if (!namespaces.has(key)) namespaces.set(key, new Map());
      return namespaces.get(key);
    } } };
    return als.run(state, async () => {
      if (input.fail) {
        const first = await adapter.getLastRevalidated(["retry"]);
        const retry = await adapter.getLastRevalidated(["retry"]);
        return Response.json({ first, retry, reads });
      }
      recordPublicRequestPath(ctx, "https://test" + path, "GET");
      const checkedShell = incremental.get(path, "cache").then(async () => ({
        invalid: await adapter.hasBeenRevalidated(soft, 1),
        timestamp: await adapter.getLastRevalidated(soft),
      }));
      // The data shard is deliberately held. Shell validation must finish while
      // it is still pending, with every shell tag checked against the real adapter.
      let timer;
      const early = await Promise.race([checkedShell, new Promise(resolve => {
        timer = setTimeout(() => resolve(null), 200);
      })]);
      clearTimeout(timer);
      const hardReadsBeforeRelease = hard.every(tag => reads[tag] === 1);
      releaseHard();
      const [shell, data, missing] = await Promise.all([
        checkedShell, adapter.getLastRevalidated(hard), adapter.getLastRevalidated(["missing", "missing"]),
      ]);
      await Promise.all(retained);
      const stale = await adapter.isStale(hard, 1);
      return Response.json({ early, shell, data, missing, stale, reads, hardReadsBeforeRelease });
    });
  }};
` }, bundle: true, write: false, format: "esm", platform: "node", external: ["node:*", "cloudflare:workers"] });
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text,
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
}));
async function probe(input) {
  const response = await mf.dispatchFetch("https://test", { method: "POST", body: JSON.stringify(input) });
  assert.equal(response.status, 200);
  return response.json();
}
try {
  await Promise.all(Array.from({ length: 6 }, async (_, index) => {
    const timestamp = index + 10;
    const result = await probe({ timestamp, gate: true });
    assert.deepEqual(result.early, { invalid: true, timestamp }, "shell tags must validate before the slow data shard completes");
    assert.equal(result.hardReadsBeforeRelease, true, "data reads must already overlap shell validation");
    assert.equal(result.data, timestamp, "concurrent requests cannot reuse another request's metadata");
    assert.equal(result.missing, 0);
    assert.equal(result.stale, true, "SWR metadata must survive coalescing");
    assert.ok(Object.values(result.reads).every(count => count === 1), JSON.stringify(result.reads));
  }));
  const failed = await probe({ timestamp: 99, fail: true });
  assert.equal(failed.first, 0, "preserve adapter error fallback");
  assert.equal(failed.retry, 99, "failed reads must be evicted so the next validation retries");
  assert.equal(failed.reads.retry, 2);
  console.log("PASS: real tag adapter releases validated shells before slow data shards, coalesces every tag once per request, isolates concurrent requests, preserves missing/stale tags, and retries failures");
} finally { await mf.dispose(); }
