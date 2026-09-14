import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");

const { outputFiles } = await build({
  stdin: { contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    import { protectPersonalizedResponse } from "./cloudflare/cache-policy.ts";
    import { getOptionalAppState } from "./lib/app-state.ts";
    import { getOptionalRedis } from "@/lib/redis";
    const contexts = new AsyncLocalStorage();
    Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), {get: () => contexts.getStore()});
    export default { async fetch(request, env, ctx) { return contexts.run({env,ctx}, async () => {
      if (new URL(request.url).pathname === "/state") {
        const op = await request.json();
        if (getOptionalRedis() !== null) throw new Error("Cloudflare build must exclude Redis");
        const state = getOptionalAppState();
        if (!state) throw new Error("Redis exclusion must not disable application state");
        let result;
        switch(op.type) {
          case "get": case "del": case "incr": case "hgetall": result = await state[op.type](op.key); break;
          case "set": result = await state.set(op.key, op.value, {ex:op.ex,nx:op.nx}); break;
          case "releaseLock": result = await state.releaseLock(op.key, op.token); break;
          case "slidingWindow": result = await state.slidingWindow(op.key, op.now, op.windowMs, op.limit); break;
          case "recordVote": result = await state.recordVote(op.key, op.feedbackKey, op.vote, op.updatedAt, op.ttlSeconds); break;
          default: throw new Error("Unknown operation");
        }
        return Response.json(result);
      }
      const response = new Response("test", { headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": request.headers.get("test-content-type") || "application/javascript",
        ...(request.headers.has("test-set-cookie") ? { "Set-Cookie": "session=test; HttpOnly" } : {})
      }});
      return protectPersonalizedResponse(request, response);
    }); }};`, resolveDir: resolve(".") },
  bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers", "node:*"],
  alias: { "@/lib/redis": resolve("cloudflare/redis-unavailable.ts") },
  plugins: [{ name: "worker-context", setup(build) {
    build.onResolve({ filter: /^(server-only|@opennextjs\/cloudflare)$/ }, args => ({ path: args.path, namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: args.path === "server-only" ? "" :
      'export function getCloudflareContext() { return globalThis[Symbol.for("__cloudflare-context__")]; }' }));
  } }],
});
const { outputFiles: stateWorker } = await build({
  entryPoints: ["cloudflare/app-state-worker.ts"], bundle: true, write: false,
  format: "esm", platform: "neutral", external: ["cloudflare:workers"],
});
const workerOptions = { modules: true, compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"] };
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
  { ...workerOptions, name: "app-state-test", script: outputFiles[0].text,
    r2Buckets: ["APP_CACHE_BUCKET"],
    durableObjects: { APP_STATE: {
      className: "AppState", scriptName: "examcooker-test-app-state", useSQLite: true,
    } },
  },
  { ...workerOptions, name: "examcooker-test-app-state", script: stateWorker[0].text,
    durableObjects: { APP_STATE: { className: "AppState", useSQLite: true } },
  },
] }));
const op = async (operation) => {
  const response = await mf.dispatchFetch("http://test/state", {
    method: "POST", body: JSON.stringify(operation),
  });
  assert.equal(response.status, 200);
  return response.json();
};
try {
  const payloadKey = "ec:pdf-markdown:entry:backend-test";
  assert.equal(await op({type:"set", key:payloadKey, value:"public payload", ex:60}), "OK");
  assert.equal(await op({type:"get", key:payloadKey}), "public payload");
  assert.equal(await op({type:"del", key:payloadKey}), 1);
  assert.equal(await op({type:"get", key:payloadKey}), null);
  console.log("PASS: Redis-free application state facade uses R2 for public payloads");
  const locks = await Promise.all(Array.from({ length: 30 }, (_, i) =>
    op({ type: "set", key: "lock", value: String(i), ex: 60, nx: true })));
  assert.equal(locks.filter((value) => value === "OK").length, 1);
  const owner = await op({ type: "get", key: "lock" });
  assert.equal(await op({ type: "releaseLock", key: "lock", token: "stale-owner" }), 0);
  assert.equal(await op({ type: "get", key: "lock" }), owner);
  assert.equal(await op({ type: "releaseLock", key: "lock", token: owner }), 1);
  console.log("PASS: concurrent lock acquisition and owner-only release");

  const limits = await Promise.all(Array.from({ length: 40 }, () =>
    op({ type: "slidingWindow", key: "rate-limit", now: Date.now(), windowMs: 1000, limit: 10 })));
  assert.equal(limits.filter(([allowed]) => allowed === 1).length, 10);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.deepEqual(await op({ type: "slidingWindow", key: "rate-limit", now: Date.now(), windowMs: 1000, limit: 10 }), [1, 1]);
  console.log("PASS: global sliding-window limit under contention and expiry");

  const feedbackKey = "ec:pdf-markdown:feedback:paper:generation";
  const vote = (user, value) => op({ type: "recordVote", key: `ec:pdf-markdown:vote:paper:generation:${user}`,
    feedbackKey, vote: value, updatedAt: new Date().toISOString(), ttlSeconds: 60 });
  await Promise.all(Array.from({ length: 30 }, (_, i) => vote(`voter${i}`, "up")));
  await Promise.all(Array.from({ length: 20 }, () => vote("voter0", "up")));
  const totals = () => op({ type: "hgetall", key: feedbackKey });
  assert.equal((await totals()).upvotes, 30);
  await vote("voter0", "down");
  assert.equal((await totals()).upvotes, 29);
  assert.equal((await totals()).downvotes, 1);
  assert.equal(await op({ type: "get", key: "ec:pdf-markdown:vote:paper:generation:voter1" }), "up");
  assert.equal(await op({ type: "get", key: "ec:pdf-markdown:vote:paper:generation:voter0" }), "down");
  console.log("PASS: concurrent vote totals, duplicate votes, vote changes, and per-user isolation");

  await op({ type: "set", key: "expires", value: "old", ex: 1, nx: true });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(await op({ type: "get", key: "expires" }), null);
  assert.equal(await op({ type: "set", key: "expires", value: "new", ex: 30, nx: true }), "OK");
  assert.equal(await op({ type: "releaseLock", key: "expires", token: "old" }), 0);
  console.log("PASS: expired lock replacement cannot be released by old owner");

  for (const [path, headers] of [
    ["/", { "test-content-type": "text/html" }],
    ["/api/auth/session", {}], ["/api/auth/csrf", {}], ["/auth", {}],
    ["/mod", {}], ["/native-auth/browser-complete", {}],
    ["/papers", { cookie: "__Secure-next-auth.session-token.0=userA" }],
    ["/papers", { authorization: "Bearer userB" }],
    ["/papers", { rsc: "1" }], ["/redirect", { "test-set-cookie": "1" }],
  ]) {
    const response = await mf.dispatchFetch(`http://test${path}`, { headers });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
    if (headers["test-set-cookie"]) assert.ok(response.headers.has("set-cookie"));
  }
  const staticResponse = await mf.dispatchFetch("http://test/_next/static/chunk.js");
  assert.match(staticResponse.headers.get("cache-control"), /immutable/);
  console.log("PASS: auth, cookies (including chunks), bearer tokens, RSC and HTML bypass shared HTTP caching; static assets remain cacheable");
} finally {
  await mf.dispose();
}
