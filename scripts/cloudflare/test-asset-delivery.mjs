import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');
const {outputFiles}=await build({entryPoints:['cloudflare/assets-worker.ts'],bundle:true,write:false,format:'esm',platform:'browser',external:['node:crypto']});
let holdNext=false,releaseHeld,notifyHeld;let heldStarted;
let calls=0;let original=Buffer.from('%PDF-1.7\noriginal fixture');let sourceVersion='azure-v1';let missing=false;let stale=false;
let renders=0;let renderStatus=200;
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-09-10',compatibilityFlags:['nodejs_compat'],r2Buckets:['BUCKET'],ratelimits:{PREVIEW_RENDERS:{namespace_id:'6061',simple:{limit:6,period:60}}},bindings:{MIRROR_TOKEN:'test-only-secret'},serviceBindings:{PDF_PREVIEW:async req=>{
 renders++;const params=new URL(req.url).searchParams;const source=await(await mf.getR2Bucket('BUCKET')).head(params.get('key'));
 return new Response(renderStatus===200?`webp:${params.get('page')}:${params.get('rotation')}:${source.etag}`:'unrenderable',{status:renderStatus,headers:{'x-ec-source-etag':source.etag}});
}},outboundService:async req=>{
 calls++;assert.match(req.url,/^https:\/\/examcookerprodsi.blob.core.windows.net\/exam-assets\//);assert.equal(req.headers.get('cookie'),null);assert.equal(req.headers.get('authorization'),null);
 if(missing)return new Response(null,{status:404});
 if(stale || (req.headers.has('if-match')&&req.headers.get('if-match')!==`"${sourceVersion}"`))return new Response(null,{status:412});
 const response=new Response(original,{headers:{etag:`"${sourceVersion}"`,'content-type':'application/pdf','content-length':String(original.length),'content-md5':createHash('md5').update(original).digest('base64'),'last-modified':'Thu, 01 Oct 2026 00:00:00 GMT'}});
 if(holdNext){holdNext=false;notifyHeld();await new Promise(resolve=>{releaseHeld=resolve;});}return response;
}}));
const host='https://ec-assets.acmvit.in';const admin=(body,path='/_mirror')=>mf.dispatchFetch(host+path,{method:'POST',headers:{'x-ec-mirror-token':'test-only-secret'},body:JSON.stringify(body)});
try {
 assert.equal((await mf.dispatchFetch(host+'/_mirror',{method:'POST',body:'{}'})).status,401);
 const first=await admin({key:'past-papers/fixture/paper.pdf',expected:{etag:'azure-v1',size:original.length}});assert.equal(first.status,200);const result=await first.json();assert.equal(result.status,'copied');assert.equal(result.md5,createHash('md5').update(original).digest('hex'));assert.equal(result.sha256,createHash('sha256').update(original).digest('hex'));
 const afterCopy=calls;
 const served=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{cookie:'session=private',authorization:'Bearer private'}});assert.equal(served.status,200);assert.deepEqual(Buffer.from(await served.arrayBuffer()),original);assert.equal(served.headers.get('x-ec-asset-source'),'r2');assert.equal(served.headers.get('set-cookie'),null);assert.equal(calls,afterCopy);
 const head=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(Number(head.headers.get('content-length')),original.length);
 const cached=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{'if-none-match':head.headers.get('etag')}});assert.equal(cached.status,304);
 const range=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{range:'bytes=0-7'}});assert.equal(range.status,206);assert.equal(await range.text(),original.subarray(0,8).toString());
 const suffix=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{range:'bytes=-7'}});assert.equal(suffix.status,206);assert.equal(await suffix.text(),original.subarray(-7).toString());
 const invalidRange=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{range:'bytes=999999-'}});assert.equal(invalidRange.status,416);assert.equal(invalidRange.headers.get('content-range'),`bytes */${original.length}`);
 const ifRange=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{range:'bytes=0-7','if-range':'"stale"'}});assert.equal(ifRange.status,200);assert.deepEqual(Buffer.from(await ifRange.arrayBuffer()),original);
 const ifMatch=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{'if-match':'"stale"'}});assert.equal(ifMatch.status,412);
 const conditionalHead=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{method:'HEAD',headers:{'if-none-match':'*'}});assert.equal(conditionalHead.status,304);
 const unchanged=await admin({key:'past-papers/fixture/paper.pdf'});assert.equal((await unchanged.json()).status,'unchanged');
 original=Buffer.from('%PDF-1.7\nreplacement bytes');sourceVersion='azure-v2';
 const resource='/subscriptions/b88416d5-3d98-4d1c-bd30-8df01b99dfac/resourceGroups/rg-examcooker-prod/providers/Microsoft.Storage/storageAccounts/examcookerprodsi';
 const event={eventType:'Microsoft.Storage.BlobCreated',topic:resource,data:{url:'https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/fixture/paper.pdf'}};
 const update=await admin([event],'/_events');assert.equal(update.status,204);
 const replaced=await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{'cache-control':'no-cache'}});assert.deepEqual(Buffer.from(await replaced.arrayBuffer()),original);
 // Identical bytes retain the same ETag: the upload timestamp must also guard
 // against an older in-flight copy replacing newer source metadata.
 sourceVersion='metadata-older';holdNext=true;heldStarted=new Promise(resolve=>{notifyHeld=resolve;});
 const delayed=admin({key:'past-papers/fixture/paper.pdf'});await heldStarted;
 await new Promise(resolve=>setTimeout(resolve,10));sourceVersion='metadata-newer';
 const metadataUpdate=await admin({key:'past-papers/fixture/paper.pdf'});assert.equal(metadataUpdate.status,200);
 releaseHeld();assert.equal((await delayed).status,503);
 assert.equal((await(await mf.getR2Bucket('BUCKET')).head('past-papers/fixture/paper.pdf')).customMetadata.azureEtag,'metadata-newer');
 const invalid=await admin([{...event,data:{url:'https://private.invalid/secret'}}],'/_events');assert.equal(invalid.status,400);
 const mismatch=await admin({key:'mismatch.pdf',expected:{etag:'outdated'}});assert.equal(mismatch.status,503);assert.equal(await(await mf.getR2Bucket('BUCKET')).head('mismatch.pdf'),null);
 missing=true;const deleted=await admin([{...event,eventType:'Microsoft.Storage.BlobDeleted'}],'/_events');assert.equal(deleted.status,204);assert.equal((await mf.dispatchFetch(host+'/past-papers/fixture/paper.pdf',{headers:{'cache-control':'no-cache'}})).status,404);
 missing=false;sourceVersion='azure-v3';const fresh=await mf.dispatchFetch(host+'/new-upload.pdf');assert.equal(fresh.status,200);assert.deepEqual(Buffer.from(await fresh.arrayBuffer()),original);
 assert.equal((await mf.dispatchFetch(host+'/new-upload.pdf?token=secret')).status,404);
 assert.equal((await mf.dispatchFetch(host+'/new-upload.pdf',{method:'POST'})).status,405);
 const previewUrl=host+'/_preview/v1/past-papers/previewfixture000000001/p1-r90.webp';
 const rendered=await mf.dispatchFetch(previewUrl);assert.equal(rendered.status,200);assert.equal(rendered.headers.get('content-type'),'image/webp');assert.equal(rendered.headers.get('x-ec-asset-source'),'render');assert.match(await rendered.text(),/^webp:1:90:/);assert.equal(renders,1);
 await new Promise(resolve=>setTimeout(resolve,50));
 const edgeCached=await mf.dispatchFetch(previewUrl);assert.equal(edgeCached.headers.get('x-ec-asset-cache'),'HIT');await edgeCached.text();
 const fresh_={headers:{'cache-control':'no-cache'}};
 const reused=await mf.dispatchFetch(previewUrl,fresh_);assert.equal(reused.headers.get('x-ec-asset-source'),'r2');assert.match(await reused.text(),/^webp:1:90:/);assert.equal(renders,1);
 original=Buffer.from('%PDF-1.7\nreplaced preview source');sourceVersion='azure-v4';
 await admin({key:'past-papers/previewfixture000000001/paper.pdf'});
 const rerendered=await mf.dispatchFetch(previewUrl,fresh_);assert.equal(rerendered.headers.get('x-ec-asset-source'),'render');await rerendered.text();assert.equal(renders,2);
 renderStatus=422;const unrenderable=host+'/_preview/v1/past-papers/previewfixture000000001/p0-r0.webp';
 assert.equal((await mf.dispatchFetch(unrenderable)).status,404);await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal((await mf.dispatchFetch(unrenderable,fresh_)).status,404);assert.equal(renders,3);
 // A cold PDF read and a cold preview mirror the same source concurrently.
 const coldPaper='past-papers/previewfixture000000002/paper.pdf';
 const beforeColdMirror=calls;
 const [coldPdf,coldPreview]=await Promise.all([mf.dispatchFetch(host+'/'+coldPaper),mf.dispatchFetch(host+'/_preview/v1/past-papers/previewfixture000000002/p0-r0.webp')]);
 assert.equal(coldPdf.status,200);assert.deepEqual(Buffer.from(await coldPdf.arrayBuffer()),original);assert.equal(coldPreview.status,404);assert.equal(renders,4);
 assert.equal(calls,beforeColdMirror+1,'concurrent cold reads share one Azure copy');
 const concurrent=host+'/_preview/v1/past-papers/previewfixture000000001/p1-r180.webp';renderStatus=200;
 const pair=await Promise.all([mf.dispatchFetch(concurrent),mf.dispatchFetch(concurrent)]);
 for(const response of pair){assert.equal(response.status,200);assert.match(await response.text(),/^webp:1:180:/);}
 assert.equal(renders,5,'concurrent cold requests share one render');
 for(const path of ['/_preview/v1/past-papers/previewfixture000000001/p64-r0.webp','/_preview/v1/past-papers/short/p0-r0.webp','/_preview/v1/past-papers/previewfixture000000001/p0-r45.webp','/_preview/v2/x',
  '/_preview/v1/past-papers/previewfixture000000001/p1-r90.webp?nonce=1','/_previews/v1/past-papers/previewfixture000000001/p1-r90.webp',
  '/%5Fpreviews/v1/past-papers/previewfixture000000001/p1-r90.webp','/_previews%2Fv1%2Fpast-papers%2Fpreviewfixture000000001%2Fp1-r90.webp']){
  assert.equal((await mf.dispatchFetch(host+path)).status,404);
 }
 assert.equal(renders,5);
 // Over its allowance, a client is throttled before any render starts.
 let throttled=null;
 for(const variant of ['p1-r270','p1-r0','p0-r90']){
  const before=renders;const response=await mf.dispatchFetch(host+`/_preview/v1/past-papers/previewfixture000000001/${variant}.webp`);await response.arrayBuffer();
  if(response.status===429){throttled=response;assert.equal(renders,before,'a throttled request starts no render');break;}
  assert.equal(response.status,200);
 }
 assert.ok(throttled,'the client is throttled after its allowance');assert.equal(throttled.headers.get('retry-after'),'60');
 assert.equal((await mf.dispatchFetch(previewUrl,fresh_)).status,200,'stored previews are not throttled');
 console.log('PASS: streamed copy checksums, R2 delivery, ranges, conditional requests, new uploads, overwrite/delete events, private admin operations, safe origins, and first-page previews');
} finally {await mf.dispose();}
