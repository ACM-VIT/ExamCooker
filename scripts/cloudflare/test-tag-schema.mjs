import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const { outputFiles } = await build({
  entryPoints:["node_modules/@opennextjs/cloudflare/dist/api/durable-objects/sharded-tag-cache.js"],
  bundle:true,write:false,format:"esm",platform:"node",external:["node:*"],
  plugins:[{name:"test-context",setup(b){
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"workers",namespace:"test"}));
    b.onLoad({filter:/.*/,namespace:"test"},()=>({contents:"export class DurableObject { constructor(ctx, env) { this.ctx=ctx; this.env=env; } }"}));
  }}],
});
const { DOShardedTagCache } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
for (const columns of [null,"tag TEXT PRIMARY KEY, revalidatedAt INTEGER","tag TEXT PRIMARY KEY, revalidatedAt INTEGER, stale INTEGER","tag TEXT PRIMARY KEY, revalidatedAt INTEGER, stale INTEGER, expire INTEGER"]) {
  const db = new DatabaseSync(":memory:");
  try {
    if(columns){db.exec(`CREATE TABLE revalidations (${columns})`);db.exec("INSERT INTO revalidations (tag,revalidatedAt) VALUES ('existing',123)");}
    const queries=[];const pending=[];
    const state={storage:{sql:{exec(query,...bindings){
      queries.push(query);
      const statement=db.prepare(query);
      const rows=/^(SELECT|PRAGMA)/i.test(query.trim())?statement.all(...bindings):(statement.run(...bindings),[]);
      return {toArray:()=>rows};
    }}},blockConcurrencyWhile(fn){const p=fn();pending.push(p);return p;}};
    let cache=new DOShardedTagCache(state,{});await Promise.all(pending);
    assert.deepEqual(db.prepare("PRAGMA table_info(revalidations)").all().map(c=>c.name),["tag","revalidatedAt","stale","expire"]);
    if(columns)assert.equal((await cache.getTagData(["existing"])).existing.revalidatedAt,123);
    await cache.writeTags([{tag:"updated",stale:200,expire:300}]);
    assert.deepEqual((await cache.getTagData(["updated"])).updated,{revalidatedAt:200,stale:200,expire:300});
    queries.length=0;pending.length=0;
    cache=new DOShardedTagCache(state,{});await Promise.all(pending);
    assert.equal(queries.filter(q=>/^(CREATE|ALTER|INSERT|UPDATE|DELETE)/i.test(q.trim())).length,0,"restarting an initialized shard must not perform writes");
    assert.equal((await cache.getTagData(["updated"])).updated.expire,300);
  } finally { db.close(); }
}
console.log("PASS: new and partially migrated tag schemas initialize without data loss; existing schemas restart without DDL or writes");
