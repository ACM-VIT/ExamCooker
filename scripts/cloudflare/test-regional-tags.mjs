import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: resolve("."), contents: `
  import { AsyncLocalStorage } from "node:async_hooks";
  import config from "./open-next.config.ts";
  import { DOShardedTagCache } from "./node_modules/@opennextjs/cloudflare/dist/api/durable-objects/sharded-tag-cache.js";
  export { DOShardedTagCache };
  const context = new AsyncLocalStorage();
  Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => context.getStore() });
  globalThis.openNextConfig = config;
  const cache = config.default.override.tagCache();
  export default { async fetch(request, env, ctx) {
    const { continent, write, tag } = await request.json();
    return context.run({ env, ctx, cf: { continent } }, async () => {
      if (write) await cache.writeTags([{ tag, expire: Date.now() }]);
      return Response.json({ invalidated: await cache.hasBeenRevalidated([tag], 1) });
    });
  }};` }, bundle: true, write: false, format: "esm", platform: "node",
  external: ["cloudflare:workers", "node:*"],
});
const mf = new Miniflare(convertV4MiniflareOptions({ name: "regional-tag-test", modules: true,
  script: outputFiles[0].text, compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { NEXT_TAG_CACHE_DO_SHARDED: { className: "DOShardedTagCache", useSQLite: true } },
}));
async function read(continent, tag, write = false) {
  const response = await mf.dispatchFetch("https://test", { method: "POST", body: JSON.stringify({ continent, tag, write }) });
  if (response.status !== 200) throw new Error(await response.text());
  return (await response.json()).invalidated;
}
try {
  assert.equal(await read("AS", "untouched-control"), false);
  assert.equal(await read("AS", "regional-invalidation", true), true);
  for (const continent of ["AS", "EU", "NA", "SA", "AF", "OC"]) {
    assert.equal(await read(continent, "regional-invalidation"), true, continent);
    assert.equal(await read(continent, "untouched-control"), false, continent);
  }
  console.log("PASS: the deployed tag-cache configuration propagates invalidation to all six regions; unrelated tags remain valid");
} finally { await mf.dispose(); }
