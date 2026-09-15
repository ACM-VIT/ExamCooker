import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    import config from "./open-next.config.ts";
    import { FALLBACK_BUILD_ID } from "./node_modules/@opennextjs/cloudflare/dist/api/overrides/internal.js";
    export { DOShardedTagCache } from "./node_modules/@opennextjs/cloudflare/dist/api/durable-objects/sharded-tag-cache.js";
    const context = new AsyncLocalStorage();
    Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => context.getStore() });
    globalThis.openNextConfig = config;
    const data = config.default.override.incrementalCache();
    const tags = config.default.override.tagCache();
    export default { async fetch(request, env, ctx) {
      return context.run({ env, ctx, cf: { continent: "AS" } }, async () => {
        const key = "retention-probe";
        if (request.method === "PUT") {
          await data.set(key, { value: "public content", tags: [key], revalidate: 300 }, "composable");
          return new Response(null, { status: 204 });
        }
        const entry = await data.get(key, "composable");
        const local = await caches.open("incremental-cache");
        const buildId = process.env.OPEN_NEXT_BUILD_ID ?? FALLBACK_BUILD_ID;
        const response = await local.match("http://cache.local/" + buildId + "/" + key + ".composable");
        await tags.writeTags([{ tag: key, expire: entry.lastModified + 1 }]);
        return Response.json({
          content: entry.value.value,
          bypass: entry.shouldBypassTagCache,
          cacheControl: response.headers.get("cache-control"),
          invalidated: await tags.hasBeenRevalidated([key], entry.lastModified),
          unrelated: await tags.hasBeenRevalidated(["unrelated"], entry.lastModified),
        });
      });
    }};
  ` },
  bundle: true, write: false, format: "esm", platform: "node",
  external: ["node:*", "cloudflare:workers"],
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text,
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
  r2Buckets: ["NEXT_INC_CACHE_R2_BUCKET"],
  durableObjects: { NEXT_TAG_CACHE_DO_SHARDED: { className: "DOShardedTagCache", useSQLite: true } },
}));
try {
  assert.equal((await mf.dispatchFetch("https://test", { method: "PUT" })).status, 204);
  const response = await mf.dispatchFetch("https://test");
  if (response.status !== 200) throw new Error(await response.text());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    content: "public content", bypass: false, cacheControl: "max-age=300",
    invalidated: true, unrelated: false,
  });
  console.log("PASS: retained regional data keeps its revalidation lifetime and remains subject to tag invalidation");
} finally {
  await mf.dispose();
}
