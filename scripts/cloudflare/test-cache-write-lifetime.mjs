import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    import { withCacheWriteLifetime } from "./cloudflare/cache-write-lifetime.ts";
    const context = new AsyncLocalStorage();
    Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => context.getStore() });
    export default { async fetch(request, env, ctx) {
      const key = new URL(request.url).pathname;
      const registered = [];
      const retained = { waitUntil(promise) {
        registered.push(promise);
        ctx.waitUntil(promise.catch(() => {}));
      }};
      return context.run({env, ctx: retained}, async () => {
        let finished = false;
        const backend = {
          name: "delayed-r2",
          async get(key) { const value = await env.BUCKET.get(key); return value?.text() ?? null; },
          async delete(key) { await env.BUCKET.delete(key); },
          async set(key, value, type) {
            await new Promise(resolve => setTimeout(resolve, 80));
            if (key === "/reject") throw new Error("storage unavailable");
            await env.BUCKET.put(key, JSON.stringify({value, type}));
            finished = true;
          },
        };
        const cache = withCacheWriteLifetime(backend);
        if (request.method === "GET") return Response.json(await cache.get(key));
        if (request.method === "DELETE") { await cache.delete(key); return new Response(null,{status:204}); }
        const value = await request.text();
        const pending = cache.set(key, value, "composable");
        const result = { registered: registered.length, samePromise: registered[0] === pending, finished, name: cache.name };
        if (key === "/reject") {
          result.error = await pending.then(() => null, error => error.message);
          result.retainedError = await registered[0].then(() => null, error => error.message);
        }
        // Deliberately return before the storage write completes, as streaming
        // renders do. Only waitUntil should retain the pending storage work.
        return Response.json(result);
      });
    }};
  ` }, bundle: true, write: false, format: "esm", platform: "node",
  external: ["node:*", "cloudflare:workers"],
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text, r2Buckets: ["BUCKET"],
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
}));
try {
  await Promise.all(Array.from({length:8}, async (_, i) => {
    const response = await mf.dispatchFetch(`http://test/value-${i}`, {method:"POST", body:`payload-${i}`});
    assert.deepEqual(await response.json(), {registered:1, samePromise:true, finished:false, name:"delayed-r2"});
  }));
  await new Promise(resolve => setTimeout(resolve, 200));
  for (let i = 0; i < 8; i++) {
    const response = await mf.dispatchFetch(`http://test/value-${i}`);
    assert.deepEqual(JSON.parse(await response.json()), {value:`payload-${i}`, type:"composable"});
  }
  await mf.dispatchFetch("http://test/value-0", {method:"DELETE"});
  assert.equal(await (await mf.dispatchFetch("http://test/value-0")).json(), null);
  const rejected = await (await mf.dispatchFetch("http://test/reject", {method:"POST",body:"ignored"})).json();
  assert.equal(rejected.error, "storage unavailable");
  assert.equal(rejected.retainedError, rejected.error);
  console.log("PASS: late cache writes persist after HTTP completion across eight requests; reads, deletion and write failures preserve their behavior");
} finally { await mf.dispose(); }
