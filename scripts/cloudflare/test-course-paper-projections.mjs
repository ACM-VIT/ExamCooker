import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import assert from "node:assert/strict";
  import { paginateCoursePaperRows, buildCoursePaperFilterOptions } from "./lib/data/course-papers.ts";
  const base = { title: "Paper", fileUrl: "https://example.invalid/p.pdf", thumbNailUrl: null,
    pageEdits: null, campus: "VELLORE", semester: "FALL", slot: "A1", hasAnswerKey: false };
  const rows = [
    {...base,id:"a",examType:"CAT_1",year:2025,createdAtTime:1,hasAnswerKey:true},
    {...base,id:"b",examType:"CAT_2",year:2026,createdAtTime:2,slot:"B1"},
    {...base,id:"c",examType:"CAT_1",year:2026,createdAtTime:3,campus:"CHENNAI",semester:"WINTER"},
    {...base,id:"d",examType:null,year:null,createdAtTime:4,slot:null},
  ];
  const before=JSON.stringify(rows);
  const input={courseId:"math",filters:{},page:1,pageSize:24};
  const ids=(options)=>paginateCoursePaperRows(rows,{...input,...options}).papers.map(p=>p.id);
  assert.deepEqual(ids({sort:"recent"}),["d","c","b","a"]);
  assert.deepEqual(ids({sort:"year_desc"}),["c","b","a","d"]);
  assert.deepEqual(ids({sort:"year_asc"}),["a","c","b","d"]);
  assert.deepEqual(ids({sort:"seasonal",examFocus:"CAT_1"}),["c","a","b","d"]);
  assert.deepEqual(ids({sort:"recent",pageSize:2,page:2}),["b","a"]);
  assert.deepEqual(ids({sort:"recent",filters:{hasAnswerKey:true}}),["a"]);
  assert.deepEqual(ids({sort:"recent",filters:{campuses:["CHENNAI"],semesters:["WINTER"]}}),["c"]);
  assert.deepEqual(ids({sort:"recent",filters:{slots:["B1"],years:[2026],examTypes:["CAT_2"]}}),["b"]);
  assert.deepEqual(ids({sort:"recent",filters:{years:[2000]}}),[]);
  const filtered=buildCoursePaperFilterOptions(rows,{examTypes:["CAT_1"]});
  // Each facet excludes its own filter, so other exam choices stay available.
  assert.deepEqual(filtered.examCounts,{CAT_1:2,CAT_2:1});
  assert.deepEqual(filtered.yearCounts,{2025:1,2026:1});
  assert.equal(filtered.answerKeyCount,1);
  assert.deepEqual(filtered.slotCounts,{A1:2});
  assert.equal(paginateCoursePaperRows(rows,{...input,sort:"recent",pageSize:2}).totalCount,4);
  assert.equal(JSON.stringify(rows),before,"filtering and sorting must not mutate the shared snapshot");
  console.log("PASS: public row snapshots preserve sorts, pagination, all filters and independent facet counts without mutation");
` }, bundle: true, write: false, format: "esm", platform: "node", plugins: [{name:"isolate-data",setup(build){
  build.onResolve({filter:/^(next\/cache|@\/db|@\/lib\/cache\/past-papers-surface-cache)$/},args=>({path:args.path,namespace:"test"}));
  build.onLoad({filter:/.*/,namespace:"test"},({path})=>({contents:path==="next/cache"?
    "export const cacheLife=()=>{};export const cacheTag=()=>{};":path==="@/db"?
    'export const db={},pastPaper={},campusValues=["VELLORE","CHENNAI"],semesterValues=["FALL","WINTER"];':
    'export const withPastPapersSurfaceRedisCache=()=>{throw Error("Unexpected storage read")};'}));
}}] });
await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
