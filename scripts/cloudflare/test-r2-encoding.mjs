import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const populator = fileURLToPath(new URL("../cli/workers/r2-cache.js", import.meta.resolve("@opennextjs/cloudflare")));
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    import cache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
    import populator from ${JSON.stringify(populator)};
    const context = new AsyncLocalStorage();
    Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => context.getStore() });
    export default { fetch(request, env, ctx) {
      return context.run({env:{NEXT_INC_CACHE_R2_BUCKET:env.R2},ctx}, async () => {
        const { mode, value } = await request.json();
        const key = cache.getR2Key("encoding-test", "cache");
        if (mode === "delete") { await cache.delete("encoding-test"); return Response.json(await cache.get("encoding-test", "cache")); }
        if (mode === "legacy") await env.R2.put(key, JSON.stringify(value));
        else if (mode === "populate") {
          const response = await populator.fetch(new Request("https://test/populate", {
            method:"POST", headers:{"x-opennext-cache-key":key}, body:JSON.stringify(value),
          }), env);
          if (!response.ok) throw Error("Population failed");
        } else await cache.set("encoding-test", value, "cache");
        const stored = await env.R2.head(key);
        const entry = await cache.get("encoding-test", "cache");
        return Response.json({entry,bytes:stored.size,encoding:stored.customMetadata.ecEncoding ?? null,uploaded:stored.uploaded.getTime()});
      });
    }};
  ` }, bundle: true, write: false, format: "esm", platform: "node", external: ["node:*"],
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text,
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"], r2Buckets: ["R2"],
}));
const large = { type: "app", html: "<p>Public syllabus café हिन्दी</p>".repeat(6000), meta: { tags: ["courses"], revalidate: 300 } };
const small = { type: "app", html: "small public shell" };
async function run(mode, value, compressed) {
  const response = await mf.dispatchFetch("https://test", { method: "POST", body: JSON.stringify({mode,value}) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.entry.value, value, mode);
  assert.equal(result.entry.lastModified, result.uploaded, "Encoding must not change cache age");
  assert.equal(result.encoding, compressed ? "gzip-v1" : null, mode);
  if (compressed) assert.ok(result.bytes < Buffer.byteLength(JSON.stringify(value)) / 2);
}
try {
  await run("legacy", large, false);
  await run("set", large, true);
  await run("set", small, false); // Overwriting must clear prior encoding metadata.
  await run("populate", large, true);
  await run("populate", small, false);
  const deleted = await mf.dispatchFetch("https://test", {method:"POST",body:JSON.stringify({mode:"delete"})});
  assert.equal(await deleted.json(), null);
  console.log("PASS: legacy/runtime/deployment R2 entries round-trip in Workers; gzip preserves Unicode, cache age and overwrite/delete semantics");
} finally { await mf.dispose(); }
