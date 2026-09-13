import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: resolve("."), contents: `
  import assert from "node:assert/strict";
  import { getCourseDetailByCode, getCourseTitleVariants, getSearchableCourseRecords } from "./lib/data/course-catalog.ts";
  import { invalidatePastPapersSurfaceCache } from "./lib/cache/past-papers-surface-cache.ts";
  import { control } from "@/db";
  const [detail, variants, search] = await Promise.all([
    getCourseDetailByCode(" bmat 202l "), getCourseTitleVariants(" Complex Variables "), getSearchableCourseRecords(),
  ]);
  assert.deepEqual(detail, { id: "math", code: "BMAT202L", title: "Complex Variables", aliases: ["CV"], paperCount: 24, noteCount: 3 });
  assert.equal(variants.length, 2);
  assert.deepEqual(search.find(row => row.code === "BCSE999L").aliases, ["NLP"]);
  assert.deepEqual((await getCourseDetailByCode("BCSE999L")).aliases, []);
  assert.equal((await getCourseDetailByCode("BMAT999L")).paperCount, 0);
  assert.equal(await getCourseDetailByCode("UNKNOWN"), null);
  assert.equal(await getCourseDetailByCode("  "), null);
  assert.equal(control.queries, 3, "all readers should share the catalog's three queries");
  console.log("PASS: detail, counts, title variants, empty courses, normalization and search aliases share one catalog fill");
  control.papers = 25;
  await invalidatePastPapersSurfaceCache();
  assert.equal((await getCourseDetailByCode("BMAT202L")).paperCount, 25);
  assert.equal(control.queries, 6);
  console.log("PASS: invalidation reloads course details from the updated shared catalog");
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Cloudflare-Workers" }, configurable: true });
  // The source changes without updating the inner shared cache. On Cloudflare,
  // executing the Next cache loader must now read SQL directly.
  control.papers = 26;
  assert.equal((await getCourseDetailByCode("BMAT202L")).paperCount, 26);
  assert.equal(control.queries, 9);
  console.log("PASS: Cloudflare catalog misses bypass the redundant shared payload/lock and return current database counts");
` }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{
  name: "isolated-course-storage", setup(build) {
    build.onResolve({ filter: /^(next\/cache|@\/db|@\/lib\/app-state)$/ }, args => ({ path: args.path, namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents: path === "next/cache"
      ? "export const cacheTag = () => {}; export const cacheLife = () => {};"
      : path === "@/db" ? `
        export const course = {}, note = {}, pastPaper = {}, syllabi = {}, viewHistory = {};
        export const control = { queries: 0, papers: 24 };
        export const db = { select(fields) {
          control.queries++;
          const rows = "noteCount" in fields ? [{ courseId: "math", noteCount: 3 }]
            : "paperCount" in fields ? [{ courseId: "math", paperCount: control.papers }]
            : [
              { id: "math", code: "BMAT202L", title: "Complex Variables", aliases: ["CV"] },
              { id: "empty", code: "BMAT999L", title: "Complex Variables", aliases: null },
              { id: "nlp", code: "BCSE999L", title: "Natural Language Processing", aliases: null },
            ];
          const query = { from() { return query; }, where() { return query; }, groupBy() { return query; },
            then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); } };
          return query;
        } };
      ` : `
        const data = new Map();
        export function getOptionalAppState() { return {
          async get(key) { return data.get(key) ?? null; },
          async set(key,value,options) { if (options?.nx && data.has(key)) return null; data.set(key,value); return "OK"; },
          async del(key) { return Number(data.delete(key)); },
          async incr(key) { const n = Number(data.get(key) || 0) + 1; data.set(key,n); return n; },
          async releaseLock(key,token) { if(data.get(key)!==token)return 0; data.delete(key); return 1; },
        }; }
      ` }));
  },
}] });
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
