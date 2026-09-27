import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.resolve('wrangler/package.json'));
const { build } = require('esbuild');
const directory = await mkdtemp(join(tmpdir(), 'ec-paper-cache-'));
const mocks = {
  '@/app/auth': 'export async function auth(){return {user:{role:globalThis.fixture.role}}}',
  '@/db': `export const pastPaper={id:'id'};export const db={update(){return {set(value){return {where(id){return {async returning(){fixture.calls.push(['write',id,value]);return [{id}]}}}}}}}};`,
  'drizzle-orm': 'export const eq=(_column,id)=>id;',
  '@/lib/app-state': `export function getOptionalAppState(){return {async incr(key){await Promise.resolve();fixture.calls.push(['namespace',key]);return 1}}}`,
  'next/cache': `export function updateTag(tag){fixture.calls.push(['expire',tag])}export function revalidateTag(tag,profile){fixture.calls.push(['route-expire',tag,profile])}`,
};
const envBefore = { ...process.env };
const originalFetch = globalThis.fetch;
try {
  const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
    export {updatePastPaperPageEdits as edit} from './app/actions/update-past-paper-page-edits.ts';
    export {POST as invalidate} from './app/api/internal/revalidate-past-papers/route.ts';
    export * from './lib/cache/past-papers-revalidation.ts';
  ` }, bundle: true, write: false, format: 'esm', platform: 'node', external: ['node:*'], plugins: [{ name: 'isolated-persistence', setup(build) {
    build.onResolve({filter:/.*/}, args => Object.hasOwn(mocks,args.path) ? {path:args.path,namespace:'fixture'} : undefined);
    build.onLoad({filter:/.*/,namespace:'fixture'}, args=>({contents:mocks[args.path],loader:'js'}));
  }}] });
  const modulePath = join(directory,'probe.mjs');
  await writeFile(modulePath,result.outputFiles[0].text);
  const m=await import(modulePath);
  process.env.NODE_ENV='test';
  process.env.AUTH_SECRET='isolated-regression-secret';
  globalThis.fixture={role:'USER',calls:[]};
  await assert.rejects(m.edit({id:'fixture-paper',pageEdits:{pageRotations:{'0':90}}}),/Access denied/);
  assert.deepEqual(fixture.calls,[]);
  fixture.role='MODERATOR';
  const saved=await m.edit({id:'fixture-paper',pageEdits:{pageRotations:{'0':90}}});
  assert.equal(saved.pageEdits.pageRotations['0'],90);
  assert.deepEqual(fixture.calls.map(c=>c[0]),['write','namespace','expire','expire']);
  assert.equal(fixture.calls[0][1],'fixture-paper');
  assert.deepEqual(fixture.calls.slice(2),[['expire','past_papers'],['expire','past_paper:fixture-paper']]);
  fixture.calls=[];
  for(const token of [null,'invalid',m.signPaperRevalidation('wrong-secret'),m.signPaperRevalidation(process.env.AUTH_SECRET,Date.now()-120_000),m.signPaperRevalidation(process.env.AUTH_SECRET,Date.now()+120_000)]){
    const response=await m.invalidate(new Request('https://example.test/api/internal/revalidate-past-papers',{method:'POST',headers:token?{[m.PAPER_REVALIDATION_HEADER]:token}:{}}));
    assert.equal(response.status,403);assert.deepEqual(fixture.calls,[]);
  }
  const response=await m.invalidate(new Request('https://example.test/api/internal/revalidate-past-papers',{method:'POST',headers:{[m.PAPER_REVALIDATION_HEADER]:m.signPaperRevalidation(process.env.AUTH_SECRET)}}));
  assert.equal(response.status,204);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.deepEqual(fixture.calls.map(c=>c[0]),['namespace','route-expire','route-expire','route-expire']);
  assert.ok(fixture.calls.slice(1).every(c=>c[2].expire===0));
  process.env.NODE_ENV='production';process.env.NEXT_PUBLIC_BASE_URL='https://examcooker.acmvit.in';
  let notified=0;
  globalThis.fetch=async(url,options)=>{
    notified++;assert.equal(url,'https://examcooker.acmvit.in'+m.PAPER_REVALIDATION_PATH);
    assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');
    assert.equal(m.verifyPaperRevalidation(options.headers[m.PAPER_REVALIDATION_HEADER],process.env.AUTH_SECRET),true);
    return new Response(null,{status:204});
  };
  await m.revalidateCloudflarePaperCache();assert.equal(notified,1);
  process.env.NEXT_PUBLIC_BASE_URL='https://ec-test.acmvit.in';
  await m.revalidateCloudflarePaperCache();assert.equal(notified,1,'Test saves must not invalidate production');
  console.log('PASS: one-paper save expires local caches after persistence; authenticated cross-backend invalidation expires only public tags; invalid/expired signatures and test propagation are rejected');
} finally {
  globalThis.fetch=originalFetch;delete globalThis.fixture;
  for(const key of ['NODE_ENV','AUTH_SECRET','NEXT_PUBLIC_BASE_URL']){
    if(envBefore[key]===undefined)delete process.env[key];else process.env[key]=envBefore[key];
  }
  await rm(directory,{recursive:true,force:true});
}
