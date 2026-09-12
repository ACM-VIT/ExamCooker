import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: resolve("."), contents: `
  import assert from "node:assert/strict";
  import { withPastPapersSurfaceRedisCache as cached, invalidatePastPapersSurfaceCache as invalidate } from "./lib/cache/past-papers-surface-cache.ts";
  let calls = 0;
  const optional = { keyParts: ["optional-sibling"], cacheNull: true };
  const absent = async () => { calls++; return null; };
  assert.deepEqual(await Promise.all([cached(optional, absent), cached(optional, absent)]), [null, null]);
  assert.equal(calls, 1);
  await cached(optional, absent);
  assert.equal(calls, 1);
  console.log("PASS: concurrent and repeated successful optional misses use the cached null result");
  await invalidate();
  assert.deepEqual(await cached(optional, async () => ({ id: "new-sibling" })), { id: "new-sibling" });
  console.log("PASS: content invalidation exposes a newly added sibling");
  calls = 0;
  await cached({ keyParts: ["required-paper"] }, absent);
  await cached({ keyParts: ["required-paper"] }, absent);
  assert.equal(calls, 2);
  console.log("PASS: missing primary resources still bypass negative caching");
  await assert.rejects(cached({ keyParts: ["failed"], cacheNull: true }, async () => { throw new Error("database failure"); }));
  assert.equal(await cached({ keyParts: ["failed"], cacheNull: true }, async () => "recovered"), "recovered");
  console.log("PASS: failed lookups do not poison the cache or retain the lock");
` }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{
  name: "isolated-state", setup(build) {
    build.onResolve({ filter: /^@\/lib\/app-state$/ }, () => ({ path: "state", namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
      const data = new Map();
      export function getOptionalAppState() { return {
        async get(key) { return data.get(key) ?? null; },
        async set(key, value, options) { if (options?.nx && data.has(key)) return null; data.set(key,value); return "OK"; },
        async del(key) { return Number(data.delete(key)); },
        async incr(key) { const n = Number(data.get(key) || 0) + 1; data.set(key,String(n)); return n; },
        async releaseLock(key, token) { if (data.get(key) !== token) return 0; data.delete(key); return 1; }
      }; }
    ` }));
  },
}] });
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
