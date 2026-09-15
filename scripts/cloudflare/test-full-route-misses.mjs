import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ entryPoints: ["cloudflare/full-route-misses.ts"],
  bundle: true, write: false, format: "esm", platform: "node" });
const { withFullRouteMissCache } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
let reads = 0;
const entries = new Map();
const backend = {
  name: "test-cache",
  async get(key) { reads++; return entries.get(key) ?? null; },
  async set(key, value) { entries.set(key, value); },
  async delete(key) { entries.delete(key); },
};
const cache = withFullRouteMissCache(backend);
const realNow = Date.now;
let now = realNow();
Date.now = () => now;
try {
  assert.equal(cache.name, backend.name);
  await cache.get("/dynamic", "cache");
  await cache.get("/dynamic", "cache");
  assert.equal(reads, 1);
  now += 5000;
  await cache.get("/dynamic", "cache");
  assert.equal(reads, 2, "a remote write becomes discoverable after five seconds");
  for (const type of ["composable", "fetch", undefined]) {
    const before = reads;
    await cache.get("/dynamic", type);
    await cache.get("/dynamic", type);
    assert.equal(reads - before, 2, "data caches must not use remembered shell misses");
  }
  const value = { value: { type: "app", html: "public shell" }, lastModified: now };
  await cache.set("/dynamic", value, "cache");
  assert.equal(await cache.get("/dynamic", "cache"), value);
  await cache.delete("/dynamic");
  assert.equal(await cache.get("/dynamic", "cache"), null);
  for (let i = 0; i < 256; i++) await cache.get(`/bounded-${i}`, "cache");
  const before = reads;
  await cache.get("/dynamic", "cache");
  assert.equal(reads, before + 1, "old misses are evicted at the 256-entry cap");
  const uncapped = "/" + "x".repeat(1024);
  const beforeLongKey = reads;
  await cache.get(uncapped, "cache");
  await cache.get(uncapped, "cache");
  assert.equal(reads - beforeLongKey, 2);

  // A lookup started before a write must not install an obsolete miss afterward.
  let finishRead;
  let raceReads = 0;
  const raced = withFullRouteMissCache({ ...backend, get: async () => {
    if (++raceReads === 1) return new Promise(resolve => { finishRead = resolve; });
    return value;
  }});
  const pending = raced.get("/race", "cache");
  await raced.set("/race", value, "cache");
  finishRead(null);
  assert.equal(await pending, null);
  assert.equal(await raced.get("/race", "cache"), value);
  assert.equal(raceReads, 2);

  let failures = 0;
  const failing = withFullRouteMissCache({ ...backend, async get() {
    if (++failures === 1) throw new Error("storage unavailable");
    return value;
  }});
  await assert.rejects(failing.get("/failure", "cache"), /storage unavailable/);
  assert.equal(await failing.get("/failure", "cache"), value);
  console.log("PASS: shell misses expire, stay bounded, exclude data caches, and respect writes, deletion, races and failures");
} finally { Date.now = realNow; }
