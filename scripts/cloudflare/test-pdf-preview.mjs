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
 import {renderPreviewPng,Unrenderable} from ${JSON.stringify(path.resolve('cloudflare/pdf-preview-worker.ts'))};
 export default {async fetch(request){const url=new URL(request.url);
  try{const page=await renderPreviewPng(new Uint8Array(await request.arrayBuffer()),Number(url.searchParams.get('page')),Number(url.searchParams.get('turns')));
   return new Response(page.png,{headers:{'x-size':page.width+'x'+page.height}});}
  catch(error){return new Response(String(error),{status:error instanceof Unrenderable?422:500});}}};`);
await writeFile(path.join(dir,'wrangler.json'),JSON.stringify({name:'pdf-preview-test',main:'entry.ts',compatibility_date:'2026-09-10',compatibility_flags:['nodejs_compat']}));
execFileSync(process.execPath,[path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js'),'deploy','--dry-run','--config',path.join(dir,'wrangler.json'),'--outdir',path.join(dir,'out')],{stdio:'ignore'});
const out=path.join(dir,'out');
const modules=await Promise.all((await readdir(out)).filter(file=>/\.(js|wasm)$/.test(file)).map(async file=>({
 type:file.endsWith('.wasm')?'CompiledWasm':'ESModule',path:path.join(out,file),contents:await readFile(path.join(out,file),file.endsWith('.wasm')?undefined:'utf8')})));
modules.sort((a,b)=>(a.path.endsWith('entry.js')?-1:0)-(b.path.endsWith('entry.js')?-1:0));
const mf=new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:out,compatibilityDate:'2026-09-10',compatibilityFlags:['nodejs_compat']}));

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
 console.log('PASS: PDFium preview rendering, PNG encoding, intrinsic and edit rotation, page bounds, invalid documents');
} finally {await mf.dispose();await rm(dir,{recursive:true,force:true});}
