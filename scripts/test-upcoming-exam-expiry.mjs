import assert from "node:assert/strict";
import { createRequire } from "node:module";
import vm from "node:vm";

const requireWrangler = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = requireWrangler("esbuild");
// Return the same rows throughout, as a persisted cache hit does. The public
// functions must remove elapsed exams without mutating that shared snapshot.
const result = await build({
  entryPoints: ["lib/data/upcoming-exams.ts"], bundle: true, write: false,
  format: "cjs", platform: "node", plugins: [{ name: "fixture-data", setup(build) {
    build.onResolve({ filter: /^(next\/cache|drizzle-orm|@\/db)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents:
      path === "next/cache" ? "export const cacheLife=()=>{},cacheTag=()=>{},io=async()=>{};" :
      path === "drizzle-orm" ? "export const and=()=>{},eq=()=>{},gte=()=>{},inArray=()=>{},isNull=()=>{},or=()=>{};" :
      `export const course={},upcomingExam={};
       const query={from:()=>query,innerJoin:()=>query,where:async()=>globalThis.rows.slice()};
       export const db={select:()=>query};`
    }));
  }}],
});
let now = Date.parse("2026-09-12T12:00:00Z");
const rows = [
  { id: "expires", courseId: "a", scheduledAt: new Date(now), createdAt: new Date(now) },
  { id: "future", courseId: "b", scheduledAt: new Date(now + 600_000), createdAt: new Date(now) },
  { id: "unscheduled", courseId: "b", scheduledAt: null, createdAt: new Date(now) },
];
const module = { exports: {} };
const context = vm.createContext({ module, rows, Date: class extends Date { static now() { return now; } } });
vm.runInContext(result.outputFiles[0].text, context);
const api = module.exports;
const ids = items => Array.from(items, item => item.id);
assert.deepEqual(ids(await api.getUpcomingExams(1)), ["expires"]);
now += 300_000;
assert.deepEqual(ids(await api.getUpcomingExams(1)), ["future"], "limit applies after removing expired entries");
let grouped = await api.getUpcomingExamsForCourses(["a", "b"]);
assert.equal(grouped.has("a"), false, "expired course disappears from seasonal focus");
assert.deepEqual(ids(grouped.get("b")), ["future", "unscheduled"]);
now += 900_000;
assert.deepEqual(ids(await api.getUpcomingExams()), ["unscheduled"]);
assert.equal((await api.getUpcomingExamsForCourses([])).size, 0);
assert.equal(rows.length, 3, "expiry must not mutate cached data");
console.log("PASS: cached exams expire across clock buckets; limits, grouping and undated exams stay correct");
