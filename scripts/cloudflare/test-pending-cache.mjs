import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireWrangler = createRequire(import.meta.resolve("wrangler/package.json"));
const requireOpenNext = createRequire(import.meta.resolve("@opennextjs/cloudflare"));
const { build } = requireWrangler("esbuild");
const { Miniflare, convertV4MiniflareOptions } = requireWrangler("miniflare");
const cacheModule = requireOpenNext.resolve("@opennextjs/aws/adapters/composable-cache.js");
const result = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    import cache from ${JSON.stringify(cacheModule)};
    const als = new AsyncLocalStorage();
    Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => als.getStore() });
    globalThis.tagCache = { mode: "nextMode" };
    globalThis.incrementalCache = {
      get: async () => undefined,
      set: async () => new Promise(resolve => setTimeout(resolve, 100)),
    };
    export default { fetch(request) {
      return als.run({ ctx: {} }, async () => {
        const value = new URL(request.url).searchParams.get("value");
        const write = cache.set("same-public-key", new Promise(resolve => setTimeout(() => resolve({
          value: new ReadableStream({start(controller) {
            controller.enqueue(new TextEncoder().encode(value)); controller.close();
          }}), tags: [], timestamp: Date.now(), revalidate: 60, expire: 3600, stale: 60,
        }), 20)));
        // Another request must not supply this request's pending stream.
        await new Promise(resolve => setTimeout(resolve, 5));
        const first = await cache.get("same-public-key");
        const firstValue = first && await new Response(first.value).text();
        // The pending value remains available while the durable write finishes.
        await new Promise(resolve => setTimeout(resolve, 10));
        const second = await cache.get("same-public-key");
        const secondValue = second && await new Response(second.value).text();
        await write;
        return Response.json({ firstValue, secondValue });
      });
    }};
  ` }, bundle: true, write: false, format: "esm", platform: "node",
  external: ["node:*"],
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: result.outputFiles[0].text,
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
}));
try {
  await Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const value = `request-${i}`;
    const response = await mf.dispatchFetch(`http://test/?value=${value}`);
    assert.deepEqual(await response.json(), { firstValue: value, secondValue: value });
  }));
  console.log("PASS: pending cache streams stay request-local and readable until storage writes finish");
} finally { await mf.dispose(); }
