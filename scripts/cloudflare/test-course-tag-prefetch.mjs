import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { AsyncLocalStorage } from "node:async_hooks";
  import { withCourseTagPrefetch } from "./cloudflare/course-tag-prefetch.ts";
  const storage = new AsyncLocalStorage();
  globalThis.__openNextAls = storage;
  Object.defineProperty(globalThis, Symbol.for("__cloudflare-context__"), { get: () => storage.getStore() });
  globalThis.tagCache = { async getLastRevalidated(tags) {
    const request = storage.getStore();
    request.events.push("tags-start");
    request.tags = tags;
    await new Promise(resolve => setTimeout(resolve, 40));
    if (request.fail) throw new Error("tag lookup failed");
    request.tagTimestamp = request.timestamp;
    request.events.push("tags-end");
    return request.timestamp;
  }};
  const cache = withCourseTagPrefetch({ name:"test", async get() {
    storage.getStore().events.push("shell"); return null;
  }, async set(){ storage.getStore().writes++; }, async delete(){ storage.getStore().deletes++; } });
  export default { async fetch(request, env, nativeCtx) {
    const input = await request.json();
    const pending=[];
    const state={env,events:[],writes:0,deletes:0,...input,ctx:{waitUntil(p){pending.push(p);nativeCtx.waitUntil(p);}}};
    return storage.run(state,async()=>{
      await cache.get(input.key,input.type);
      const initial=[...state.events];
      await cache.get(input.key,input.type);
      await Promise.all(pending);
      await cache.set(input.key,{},input.type); await cache.delete(input.key);
      return Response.json({initial,events:state.events,tags:state.tags,timestamp:state.tagTimestamp,retained:pending.length,writes:state.writes,deletes:state.deletes});
    });
  }};
` }, bundle:true,write:false,format:"esm",platform:"node",external:["node:*","cloudflare:workers"] });
const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:outputFiles[0].text,
  compatibilityDate:"2026-09-10",compatibilityFlags:["nodejs_compat"]}));
async function probe(input) {
  const r=await mf.dispatchFetch("https://test",{method:"POST",body:JSON.stringify(input)});
  assert.equal(r.status,200);return r.json();
}
try {
  await Promise.all(Array.from({length:8},async(_,i)=>{
    const r=await probe({key:i%2?"/past_papers/[code]":"/past_papers/BMAT202L",type:"cache",timestamp:i+1});
    assert.deepEqual(r.initial,["tags-start","shell"]);
    assert.equal(r.retained,1);
    assert.equal(r.events.filter(e=>e==="tags-start").length,1);
    assert.equal(r.timestamp,i+1,"tag results remain scoped to each request");
    assert.ok(r.tags.includes("past_papers"));
    assert.equal(r.writes,1);assert.equal(r.deletes,1);
  }));
  for (const input of [{key:"/api/auth/session",type:"cache"},{key:"/past_papers/create",type:"cache"},{key:"/past_papers/BMAT202L",type:"composable"},{key:"/past_papers/BMAT202L",type:"fetch"}]) {
    assert.equal((await probe(input)).retained,0);
  }
  const failed=await probe({key:"/past_papers/BMAT202L",type:"cache",fail:true});
  assert.equal(failed.timestamp,undefined);
  assert.equal(failed.events.filter(e=>e==="shell").length,2);
  console.log("PASS: course-tag reads overlap shells, run once per request, stay isolated, preserve writes, and fail without blocking page reads");
} finally { await mf.dispose(); }
