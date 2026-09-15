import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");
const { outputFiles } = await build({
  stdin: { resolveDir: resolve("."), contents: `
    import { createRegionalPublicCache } from "./lib/regional-public-cache.ts";
    export default { async fetch(request, env) {
      const { operation, key, value, ttl = 900, offset = 0 } = await request.json();
      const pending = []; let reads = 0;
      const bucket = {
        get: (...args) => { reads++; return env.BUCKET.get(...args); },
        put: (...args) => env.BUCKET.put(...args),
        delete: (...args) => env.BUCKET.delete(...args),
      };
      if (operation === "pending-write") {
        let rejectWrite;
        const gate = new Promise((_, reject) => { rejectWrite = reject; });
        const storage = { ...bucket, put: () => gate };
        const ctx = { waitUntil: p => pending.push(p) };
        const create = (context = ctx, origin = "https://ec-test.acmvit.in", clock = Date.now) =>
          createRegionalPublicCache(storage, context, origin, clock);
        const producer = create();
        const write = producer.set(key, "pending public value", 60).catch(() => "failed");
        const sameRequest = await create().get(key);
        const otherRequest = await create({ waitUntil: p => pending.push(p) }).get(key);
        const otherOrigin = await create(ctx, "https://other.invalid").get(key);
        const newGeneration = await create().get(key.replace(":n0:", ":n1:"));
        const expired = await create(ctx, undefined, () => Date.now() + 61000).get(key);
        rejectWrite(Error("simulated write failure"));
        await write;
        const failed = await create().get(key);
        const secondWrite = producer.set(key, "another value", 60).catch(() => undefined);
        await secondWrite;
        const failedWithoutExpiry = await create().get(key);
        await Promise.all(pending);
        return Response.json({ sameRequest, otherRequest, otherOrigin, newGeneration,
          expired, failed, failedWithoutExpiry });
      }
      const cache = createRegionalPublicCache(bucket, { waitUntil: p => pending.push(p) },
        "https://ec-test.acmvit.in", () => Date.now() + offset);
      try {
        const result = operation === "set" ? await cache.set(key, value, ttl)
          : operation === "del" ? await cache.del(key) : await cache.get(key);
        await Promise.all(pending);
        return Response.json({ result: result ?? null, reads });
      } catch (error) { return Response.json({ error: error.message, reads }, { status: 400 }); }
    }};` },
  bundle: true, write: false, format: "esm", platform: "neutral",
});
const mf = new Miniflare(convertV4MiniflareOptions({ name: "regional-public-cache-test",
  modules: true, script: outputFiles[0].text, compatibilityDate: "2026-09-10", r2Buckets: ["BUCKET"],
}));
const key = `ec:past-papers-surface-cache:v2:n0:${"a".repeat(64)}`;
const nextKey = key.replace(":n0:", ":n1:");
async function op(operation, fields = {}) {
  const response = await mf.dispatchFetch("https://test/", { method: "POST",
    body: JSON.stringify({ operation, key, ...fields }) });
  return { status: response.status, ...await response.json() };
}
try {
  const pendingResponse = await mf.dispatchFetch("https://test/", { method: "POST",
    body: JSON.stringify({ operation: "pending-write", key }) });
  assert.deepEqual(await pendingResponse.json(), {
    sameRequest: "pending public value", otherRequest: null, otherOrigin: null,
    newGeneration: null, expired: null, failed: null, failedWithoutExpiry: null,
  });
  console.log("PASS: a request sees its pending public fill; other requests, origins, generations, expired and failed writes do not");
  const bucket = await mf.getR2Bucket("BUCKET");
  const sourceKey = key.replace("a".repeat(64), "b".repeat(64));
  await bucket.put(`app-state/${sourceKey}`, "from R2", {
    customMetadata: { expiresAt: String(Date.now() + 900000) },
  });
  assert.deepEqual(await op("get", { key: sourceKey }), { status: 200, result: "from R2", reads: 1 });
  assert.deepEqual(await op("get", { key: sourceKey }), { status: 200, result: "from R2", reads: 0 });
  console.log("PASS: an R2 hit populates the regional cache for subsequent requests");
  // A missing value must not hide a subsequent write.
  assert.deepEqual(await op("get"), { status: 200, result: null, reads: 1 });
  await op("set", { value: "public payload" });
  assert.deepEqual(await op("get"), { status: 200, result: "public payload", reads: 0 });
  console.log("PASS: warm public reads avoid R2; missing values are not cached");
  assert.deepEqual(await op("get", { key: nextKey }), { status: 200, result: null, reads: 1 });
  await op("set", { key: nextKey, value: "edited payload" });
  assert.equal((await op("get", { key: nextKey })).result, "edited payload");
  console.log("PASS: changing the namespace generation immediately bypasses old cached content");
  await op("del");
  assert.equal((await op("get")).result, null);
  await op("set", { value: "short lived", ttl: 2 });
  assert.equal((await op("get", { offset: 3000 })).result, null);
  console.log("PASS: deletion and origin expiry prevent stale reads");
  for (const unsafe of ["session:user-a", "ec:past-papers-surface-cache:namespace-version",
    `${key}:lock`, "ec:pdf-markdown:vote:paper:user-a", "ec:pdf-markdown:entry:paper"]) {
    assert.deepEqual(await op("get", { key: unsafe }), {
      status: 400, error: "Not a versioned public cache key", reads: 0,
    });
  }
  console.log("PASS: sessions, counters, locks, votes and unversioned payloads cannot use this cache");
} finally { await mf.dispose(); }
