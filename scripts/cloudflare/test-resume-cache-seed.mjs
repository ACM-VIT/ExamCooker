import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.resolve("@opennextjs/cloudflare"));
const pluginPath = require.resolve("@opennextjs/cloudflare").replace(
  /dist\/api\/index\.js$/, "dist/cli/build/patches/plugins/cache-components.js",
);
const { patchResumeDataCache } = await import(pathToFileURL(pluginPath));
const { createPrerenderResumeDataCache, createRenderResumeDataCache } =
  require("next/dist/server/resume-data-cache/resume-data-cache.js");

const source = `let cache = factory(); store.resumeDataCache = cache;`;
const patched = patchResumeDataCache(source, "fixture");
assert.match(patched, /factory\(store\.resumeDataCache\)/);
assert.throws(() => patchResumeDataCache("let unrelated = factory();", "drift"), /Failed to preserve/);
for (const runtime of ["app-page-turbo.runtime.prod.js", "app-page-turbo-experimental.runtime.prod.js"]) {
  const contents = await readFile(require.resolve(`next/dist/compiled/next-server/${runtime}`), "utf8");
  const result = patchResumeDataCache(contents, runtime);
  // Next has one HTML and one RSC partial-prefetch initialization site.
  assert.equal((result.match(/\w+\(\w+\.resumeDataCache\)/g)?.length ?? 0) -
    (contents.match(/\w+\(\w+\.resumeDataCache\)/g)?.length ?? 0), 2, runtime);
}

const { postponed } = JSON.parse(await readFile(".next/server/app/past_papers/BMAT202L.meta", "utf8"));
const length = /^(\d+):/.exec(postponed);
const persisted = postponed.slice(length[0].length + Number(length[1]));
const seedA = createRenderResumeDataCache(persisted, 5 * 1024 * 1024);
const seedB = createRenderResumeDataCache(persisted, 5 * 1024 * 1024);
assert.ok(seedA.cache.size >= 2, "Course shell must carry course and syllabus cache entries");
const storeA = { resumeDataCache: seedA };
const storeB = { resumeDataCache: seedB };
const apply = new Function("factory", "store", patched);
apply(createPrerenderResumeDataCache, storeA);
apply(createPrerenderResumeDataCache, storeB);
assert.equal(storeA.resumeDataCache.mutable, true);
assert.deepEqual([...storeA.resumeDataCache.cache.keys()], [...seedA.cache.keys()]);
storeA.resumeDataCache.cache.set("request-a-only", Promise.resolve(undefined));
assert.equal(seedA.cache.has("request-a-only"), false);
assert.equal(storeB.resumeDataCache.cache.has("request-a-only"), false);
for (const key of seedA.cache.keys()) {
  const a = await storeA.resumeDataCache.cache.get(key);
  const b = await storeB.resumeDataCache.cache.get(key);
  assert.notEqual(a.entry.value, b.entry.value, "Decoded resume streams must belong to each request");
  assert.deepEqual(a.entry.tags, b.entry.tags, "Invalidation tags must survive seeding");
  assert.equal(a.entry.timestamp, b.entry.timestamp, "Seeding must not extend freshness");
}
console.log("PASS: HTML/RSC resume initialization keeps persisted entries, tags and age without sharing request maps or streams");
