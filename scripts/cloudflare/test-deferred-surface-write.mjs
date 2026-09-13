import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: resolve("."), contents: `
  import assert from "node:assert/strict";
  import { withPastPapersSurfaceRedisCache as cached, invalidatePastPapersSurfaceCache as invalidate } from "./lib/cache/past-papers-surface-cache.ts";
  import { control } from "test-state";
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function prompt(promise) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("response waited for cache persistence")), 500);
    })]); } finally { clearTimeout(timer); }
  }
  let loads = 0;
  const input = { keyParts: ["deferred-content"] };
  control.hold();
  assert.equal(await prompt(cached(input, async () => { loads++; return "content"; })), "content");
  assert.equal(control.locks(), 1, "producer must retain the lock while writing");
  let followerDone = false;
  const follower = cached(input, async () => { loads++; return "duplicate"; }).then(value => { followerDone = true; return value; });
  await pause(100);
  assert.equal(followerDone, false);
  assert.equal(loads, 1);
  control.release();
  await control.drain();
  assert.equal(await follower, "content");
  assert.equal(control.locks(), 0);
  assert.equal(loads, 1);
  console.log("PASS: response returns before persistence; followers reuse the fill and cannot acquire its lock");

  control.hold();
  const failure = { keyParts: ["write-failure"] };
  assert.equal(await prompt(cached(failure, async () => "first")), "first");
  control.release(new Error("simulated storage failure"));
  await control.drain();
  assert.equal(control.locks(), 0);
  assert.equal(await cached(failure, async () => "recovered"), "recovered");
  await control.drain();
  assert.equal(await cached(failure, async () => "bad"), "recovered");
  console.log("PASS: failed background writes release their locks and allow a later fill");

  control.hold();
  const edited = { keyParts: ["edited-during-fill"] };
  assert.equal(await prompt(cached(edited, async () => "old")), "old");
  await invalidate();
  assert.equal(await prompt(cached(edited, async () => "new")), "new");
  control.release();
  await control.drain();
  assert.equal(await cached(edited, async () => "bad"), "new");
  console.log("PASS: old background fills cannot overwrite an invalidated namespace");

  for (const mode of ["node", "registration-failure"]) {
    control.mode = mode;
    control.hold();
    let done = false;
    const response = cached({ keyParts: [mode] }, async () => mode).then(value => { done = true; return value; });
    await pause(30);
    assert.equal(done, false, mode);
    assert.equal(control.locks(), 1);
    control.release();
    assert.equal(await response, mode);
    assert.equal(control.locks(), 0);
  }
  console.log("PASS: Node and failed lifetime registration finish persistence before returning");
` }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{
  name: "controlled-storage", setup(build) {
    build.onResolve({ filter: /^(test-state|@\/lib\/app-state)$/ }, () => ({ path: "state", namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
      const data = new Map();
      let gate = Promise.resolve(), finish;
      const pending = [];
      export const control = {
        mode: "background",
        hold() { gate = new Promise((resolve, reject) => { finish = error => error ? reject(error) : resolve(); }); },
        release(error) { const release = finish; gate = Promise.resolve(); release(error); },
        locks() { return [...data.keys()].filter(key => key.endsWith(":lock")).length; },
        async drain() { await Promise.all(pending.splice(0)); },
      };
      export function getOptionalAppState() { return {
        deferCacheWrite: control.mode === "node" ? undefined : write => {
          if (control.mode === "registration-failure") throw Error("simulated context failure");
          pending.push(write);
        },
        async get(key) { return data.get(key) ?? null; },
        async set(key, value, options) {
          if (options?.nx) { if (data.has(key)) return null; data.set(key, value); return "OK"; }
          await gate; data.set(key, value); return "OK";
        },
        async del(key) { return Number(data.delete(key)); },
        async incr(key) { const n = Number(data.get(key) || 0) + 1; data.set(key, n); return n; },
        async releaseLock(key, token) { if (data.get(key) !== token) return 0; data.delete(key); return 1; },
      }; }
    ` }));
  },
}] });
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
