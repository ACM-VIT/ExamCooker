import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: resolve("."), contents: `
  import assert from "node:assert/strict";
  import { getPastPaperDetail, getSiblingPastPaper, getAdjacentPapersInCourse, getRelatedPapersForCourse } from "./lib/data/past-paper-detail.ts";
  import { state } from "test-state";
  const siblingInput = { paperId: "current", hasAnswerKey: true, questionPaperId: "question", courseId: "course", examType: "CAT1", slot: "F1", year: 2026, semester: "WINTER", campus: "VIT" };
  async function readAll() {
    return Promise.all([
      getPastPaperDetail("current"),
      getSiblingPastPaper(siblingInput),
      getAdjacentPapersInCourse({ paperId: "current", courseId: "course", filters: {}, sort: "newest" }),
      getRelatedPapersForCourse({ paperId: "current", courseId: "course" }),
    ]);
  }
  await readAll();
  assert.equal(state.surfaceCalls, 4, "Azure/Node keeps the existing surface cache");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Cloudflare-Workers" } });
  state.title = "edited title";
  state.rotation = 90;
  state.forbidSurfaceCache = true;
  const [paper, sibling, adjacent, related] = await readAll();
  assert.equal(paper.title, "edited title");
  assert.equal(paper.pageEdits.pageRotations[0], 90);
  assert.equal(sibling.course.code, "BCSE203E");
  assert.equal(adjacent.prev.id, "previous");
  assert.equal(adjacent.next.id, "next");
  assert.equal(related[0].title, "edited title");
  assert.equal(state.surfaceCalls, 4);
  assert.ok(state.tags.includes("past_papers"));
  assert.ok(state.tags.includes("past_paper:current"));
  state.missing = true;
  assert.equal(await getPastPaperDetail("missing"), null);
  console.log("PASS: Worker cache loaders return current paper edits, sibling links and navigation without the redundant surface cache; Node behavior and Next tags are preserved");
` }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{
  name: "isolated-paper-storage", setup(build) {
    build.onResolve({ filter: /^(test-state|next\/cache|@\/db|@\/lib\/cache\/past-papers-surface-cache|@\/lib\/data\/course-papers)$/ }, args => ({ path: args.path, namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents:
      path === "test-state" ? `export const state = { title: "original", rotation: 0, surfaceCalls: 0, forbidSurfaceCache: false, missing: false, tags: [] };`
      : path === "next/cache" ? `import { state } from "test-state"; export const cacheTag = tag => state.tags.push(tag); export const cacheLife = () => {};`
      : path === "@/lib/cache/past-papers-surface-cache" ? `import { state } from "test-state"; export async function withPastPapersSurfaceRedisCache(input, loader) { if (state.forbidSurfaceCache) throw Error("Redundant remote cache entered"); state.surfaceCalls++; return loader(); }`
      : path === "@/lib/data/course-papers" ? `export async function getOrderedCoursePapers() { return [{id:"previous"}, {id:"current"}, {id:"next"}]; }`
      : `
        import { state } from "test-state";
        export const pastPaper = {}, course = {}, user = {}, tag = {}, pastPaperToTag = {};
        export const db = { select() {
          const query = { from() { return query; }, leftJoin() { return query; }, where() { return query; }, orderBy() { return query; }, limit() { return query; },
            then(resolve, reject) { return Promise.resolve(state.missing ? [] : [{
              id: "current", title: state.title, fileUrl: "https://example.test/paper.pdf", thumbNailUrl: null,
              authorId: "author", authorName: "Author", authorImage: null, courseId: "course", courseCode: "BCSE203E", courseTitle: "Web Programming",
              createdAt: new Date(), updatedAt: new Date(), hasAnswerKey: false,
              pageEdits: { pageOrder: [0], pageRotations: { 0: state.rotation } },
            }]).then(resolve, reject); }
          }; return query;
        } };
      ` }));
  },
}] });
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
