import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {inflateSync} from 'node:zlib';
import {PDFDocument, degrees, rgb} from 'pdf-lib';
const require=createRequire(import.meta.resolve('wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');

// Run the real PDFium renderer and PNG encoder in workerd, bundled by Wrangler
// exactly as for deployment. WebP conversion is the Images binding's job.
const dir=await mkdtemp(path.join(tmpdir(),'ec-pdf-preview-'));
await writeFile(path.join(dir,'entry.ts'),`
 import worker,{renderPreviewPng,Unrenderable} from ${JSON.stringify(path.resolve('cloudflare/pdf-preview-worker.ts'))};
 // Stand-in for the Images binding: returns the PNG with the requested format recorded.
 const images={input(stream){return {output(options){return Promise.resolve({response(init){
  const headers=new Headers(init?.headers);headers.set('content-type',options.format);headers.set('x-test-quality',String(options.quality));
  return new Response(stream,{headers});}});}};}};
 export default {async fetch(request,env){const url=new URL(request.url);
  if(url.pathname==='/render')return worker.fetch(request,{BUCKET:env.BUCKET,IMAGES:images});
  try{const page=await renderPreviewPng(new Uint8Array(await request.arrayBuffer()),Number(url.searchParams.get('page')),Number(url.searchParams.get('turns')));
   return new Response(page.png,{headers:{'x-size':page.width+'x'+page.height}});}
  catch(error){return new Response(String(error),{status:error instanceof Unrenderable?422:500});}}};`);
await writeFile(path.join(dir,'wrangler.json'),JSON.stringify({name:'pdf-preview-test',main:'entry.ts',compatibility_date:'2026-09-10',compatibility_flags:['nodejs_compat']}));
execFileSync(process.execPath,[path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js'),'deploy','--dry-run','--config',path.join(dir,'wrangler.json'),'--outdir',path.join(dir,'out')],{stdio:'ignore'});
const out=path.join(dir,'out');
const modules=await Promise.all((await readdir(out)).filter(file=>/\.(js|wasm)$/.test(file)).map(async file=>({
 type:file.endsWith('.wasm')?'CompiledWasm':'ESModule',path:path.join(out,file),contents:await readFile(path.join(out,file),file.endsWith('.wasm')?undefined:'utf8')})));
modules.sort((a,b)=>(a.path.endsWith('entry.js')?-1:0)-(b.path.endsWith('entry.js')?-1:0));
const mf=new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:out,r2Buckets:['BUCKET'],compatibilityDate:'2026-09-10',compatibilityFlags:['nodejs_compat']}));

function decodePng(buffer){
 const view=Buffer.from(buffer);assert.deepEqual([...view.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 let offset=8,width,height;const idat=[];
 while(offset<view.length){const length=view.readUInt32BE(offset),type=view.toString('latin1',offset+4,offset+8),data=view.subarray(offset+8,offset+8+length);
  if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],2);}
  if(type==='IDAT')idat.push(data);offset+=12+length;}
 const pixels=inflateSync(Buffer.concat(idat));assert.equal(pixels.length,(width*3+1)*height);
 const dark=(fx,fy)=>{const x=Math.floor(width*fx),y=Math.floor(height*fy),i=y*(width*3+1)+1+x*3;return pixels[i]+pixels[i+1]+pixels[i+2]<150;};
 return {width,height,dark};
}
// A landscape page with a dark block in its top-left quarter, optionally carrying its own /Rotate.
async function fixture(rotate=0,pages=1){
 const doc=await PDFDocument.create();
 for(let i=0;i<pages;i++){const page=doc.addPage([200,100]);page.drawRectangle({x:0,y:50,width:100,height:50,color:rgb(0,0,0)});if(rotate)page.setRotation(degrees(rotate));}
 return doc.save();
}
const render=async(bytes,page,turns)=>mf.dispatchFetch(`http://render/?page=${page}&turns=${turns}`,{method:'POST',body:bytes});
try {
 const plain=await render(await fixture(),0,0);assert.equal(plain.status,200);assert.equal(plain.headers.get('x-size'),'1200x600');
 let png=decodePng(await plain.arrayBuffer());assert.equal(png.width,1200);assert.equal(png.height,600);
 assert.ok(png.dark(.25,.25)&&!png.dark(.75,.25)&&!png.dark(.25,.75),'unrotated: block stays top-left');
 // A moderator quarter turn clockwise moves top-left to top-right and makes the page portrait.
 png=decodePng(await(await render(await fixture(),0,1)).arrayBuffer());assert.equal(png.width,1200);assert.equal(png.height,2400);
 assert.ok(png.dark(.75,.25)&&!png.dark(.25,.25)&&!png.dark(.75,.75),'edit rotation: block moves top-right');
 // The page's own /Rotate is applied as the viewer shows it, and edits add to it.
 png=decodePng(await(await render(await fixture(90),0,0)).arrayBuffer());assert.equal(png.width,1200);assert.equal(png.height,2400);
 assert.ok(png.dark(.75,.25)&&!png.dark(.25,.25),'intrinsic /Rotate 90: block moves top-right');
 png=decodePng(await(await render(await fixture(90),0,1)).arrayBuffer());assert.equal(png.width,1200);assert.equal(png.height,600);
 assert.ok(png.dark(.75,.75)&&!png.dark(.25,.25),'intrinsic 90 + edit 90: block ends bottom-right');
 assert.equal((await render(await fixture(0,2),1,0)).status,200);
 assert.equal((await render(await fixture(0,2),2,0)).status,422);
 assert.equal((await render(new TextEncoder().encode('not a pdf'),0,0)).status,422);
 // The deployed handler: R2 source reads, Images output, source ETag and error statuses.
 const bucket=await mf.getR2Bucket('BUCKET');const key='past-papers/handlerfixture00000000001/paper.pdf';
 const stored=await bucket.put(key,await fixture(0,2));
 const handler=(query)=>mf.dispatchFetch(`http://pdf-preview/render?${query}`);
 const ok=await handler(`key=${key}&page=1&rotation=90`);assert.equal(ok.status,200);
 assert.equal(ok.headers.get('content-type'),'image/webp');assert.equal(ok.headers.get('x-test-quality'),'72');
 assert.equal(ok.headers.get('x-ec-source-etag'),stored.etag);assert.equal(ok.headers.get('x-ec-preview-size'),'1200x2400');
 assert.equal(decodePng(await ok.arrayBuffer()).height,2400);
 const outOfRange=await handler(`key=${key}&page=2&rotation=0`);assert.equal(outOfRange.status,422);assert.equal(outOfRange.headers.get('x-ec-source-etag'),stored.etag);
 const brokenKey='past-papers/handlerfixture00000000002/paper.pdf';const broken=await bucket.put(brokenKey,'not a pdf');
 const unrenderable=await handler(`key=${brokenKey}&page=0&rotation=0`);assert.equal(unrenderable.status,422);assert.equal(unrenderable.headers.get('x-ec-source-etag'),broken.etag);
 const largeKey='past-papers/handlerfixture00000000003/paper.pdf';await bucket.put(largeKey,new Uint8Array(24*1024*1024+1));
 assert.equal((await handler(`key=${largeKey}&page=0&rotation=0`)).status,422);
 assert.equal((await handler('key=past-papers/handlerfixture00000000009/paper.pdf&page=0&rotation=0')).status,404);
 // Papers uploaded before past-papers/<id>/paper.pdf keep a root <uuid>.pdf key.
 const legacyKey='0f8e2c6a-1b3d-4e5f-8a9b-0c1d2e3f4a5b.pdf';const legacyStored=await bucket.put(legacyKey,await fixture());
 const legacy=await handler(`key=${legacyKey}&page=0&rotation=0`);assert.equal(legacy.status,200);assert.equal(legacy.headers.get('x-ec-source-etag'),legacyStored.etag);await legacy.arrayBuffer();
 for(const query of [`key=${key}&page=-1&rotation=0`,`key=${key}&page=0&rotation=45`,'key=notes/x/paper.pdf&page=0&rotation=0',`key=${key}&page=64&rotation=0`,'key=0F8E2C6A-1B3D-4E5F-8A9B-0C1D2E3F4A5B.pdf&page=0&rotation=0','key=new-upload.pdf&page=0&rotation=0']){
  assert.equal((await handler(query)).status,400,query);
 }
 console.log('PASS: PDFium preview rendering, PNG encoding, intrinsic and edit rotation, page bounds, invalid documents, and the deployed R2/Images handler (including legacy root keys)');
} finally {await mf.dispose();await rm(dir,{recursive:true,force:true});}
