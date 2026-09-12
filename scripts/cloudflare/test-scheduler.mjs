import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireWrangler = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = requireWrangler("esbuild");
const { Miniflare, convertV4MiniflareOptions } = requireWrangler("miniflare");
const scheduler = fileURLToPath(new URL("../cli/templates/cache-components-scheduler.js",
  import.meta.resolve("@opennextjs/cloudflare")));
const result = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { AsyncLocalStorage } from "node:async_hooks";
    import { runInSequentialTasks } from ${JSON.stringify(scheduler)};
    const requests = new AsyncLocalStorage();
    Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), {get: () => requests.getStore()});
    export default { fetch(request) {
      return requests.run({}, async () => {
        const depth = Number(new URL(request.url).searchParams.get("depth"));
        const log = [];
        const gates = Array.from({length: 4}, () => {
          let open;
          const promise = new Promise(resolve => { open = resolve; });
          return {promise, open};
        });
        // React work can originate before the staged render's own async context.
        for (const [stage, gate] of gates.entries()) {
          void gate.promise.then(async () => {
            for (let i = 0; i < depth; i++) await null;
            setImmediate(() => {
              log.push("work" + stage);
              setImmediate(() => log.push("flush" + stage));
            });
          });
        }
        const value = await runInSequentialTasks(() => "rendered", ...gates.map((gate, stage) => () => {
          log.push("stage" + stage); gate.open();
        }));
        // A failed render must release its queue for the next render in the request.
        await runInSequentialTasks(() => { throw new Error("expected"); }).catch(() => {});
        const recovered = await runInSequentialTasks(() => "recovered");
        return Response.json({log, value, recovered});
      });
    }};
  ` }, bundle: true, write: false, format: "esm", platform: "node", external: ["node:*"],
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: result.outputFiles[0].text,
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
}));
try {
  const log = Array.from({ length: 4 }, (_, i) => [`stage${i}`, `work${i}`, `flush${i}`]).flat();
  await Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const response = await mf.dispatchFetch(`http://test/?depth=${[0, 1, 3, 12][i % 4]}`);
    assert.deepEqual(await response.json(), { log, value: "rendered", recovered: "recovered" });
  }));
  console.log("PASS: overlapping Worker renders flush every stage and recover after a failed render");
} finally { await mf.dispose(); }
