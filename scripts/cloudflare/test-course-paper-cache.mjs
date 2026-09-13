import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: resolve("."), contents: `
  import assert from "node:assert/strict";
  import { getCoursePaperFilterOptions } from "./lib/data/course-papers.ts";
  import { stats } from "@/db";
  import { cacheStats } from "@/lib/cache/past-papers-surface-cache";
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Cloudflare-Workers" }, configurable: true });
  const cloudflare = await getCoursePaperFilterOptions("math");
  assert.equal(cloudflare.totalPapers, 1);
  assert.equal(cloudflare.answerKeyCount, 1);
  assert.deepEqual(cloudflare.examCounts, { CAT_1: 1 });
  assert.equal(cacheStats.calls, 0, "the Next cache's loader should query directly on Cloudflare");
  assert.equal(stats.queries, 1);
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Node.js" }, configurable: true });
  assert.deepEqual(await getCoursePaperFilterOptions("math"), cloudflare);
  assert.equal(cacheStats.calls, 1, "Node retains its shared cache");
  assert.deepEqual(cacheStats.keys, [["course-paper-rows-v2", { courseId: "math" }]]);
  console.log("PASS: both runtimes return identical paper data; Cloudflare avoids the redundant inner cache and Node retains it");
` }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{
  name: "controlled-paper-query", setup(build) {
    build.onResolve({ filter: /^(next\/cache|@\/db|@\/lib\/cache\/past-papers-surface-cache)$/ }, args => ({ path: args.path, namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents: path === "next/cache"
      ? "export const cacheTag = () => {}; export const cacheLife = () => {};"
      : path === "@/db" ? `
        export const pastPaper = {}, campusValues = ["VELLORE"], semesterValues = ["FALL"];
        export const stats = { queries: 0 };
        export const db = { select() {
          stats.queries++;
          const rows = [{ id: "paper", title: "Math", fileUrl: "https://example.invalid/paper.pdf", thumbNailUrl: null,
            examType: "CAT_1", slot: "A1", year: 2026, semester: "FALL", campus: "VELLORE", hasAnswerKey: true,
            pageEdits: null, createdAt: new Date("2026-01-01") }];
          const query = { from() { return query; }, where() { return query; }, then(resolve,reject) { return Promise.resolve(rows).then(resolve,reject); } };
          return query;
        } };
      ` : `
        export const cacheStats = { calls: 0, keys: [] };
        export async function withPastPapersSurfaceRedisCache(input, load) {
          cacheStats.calls++; cacheStats.keys.push(input.keyParts); return load();
        }
      ` }));
  },
}] });
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
