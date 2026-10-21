import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import ts from "typescript-api";

const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { build } = require("esbuild");
const source = ts.createSourceFile("pdfviewer.tsx", readFileSync("app/components/pdfviewer.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
// Compile the actual renderer, substituting only its PDF-plugin context and
// telemetry. No database, Next server, or production analytics are involved.
const names = ["blobToObjectUrl", "PageRenderLayer", "PageRenderError"];
const renderer = names.map(name => {
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `Missing renderer function: ${name}`);
  return declaration.getText(source);
}).join("\n");
const bundle = await build({
  stdin: {
    loader: "tsx", resolveDir: process.cwd(), sourcefile: "pdf-image-test.tsx",
    contents: `
      import React, {useCallback, useEffect, useRef, useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {PdfErrorCode} from '@embedpdf/models';
      import {foregroundTimeout} from './lib/pdf/foreground-timeout';
      import {pdfRenderOptions} from './lib/pdf/render-budget';
      import {getEffectivePdfRotation} from './lib/pdf/render-rotation';
      import {readPdfPageImageDataUrl, MAX_INLINE_PDF_IMAGE_BYTES} from './lib/pdf/page-image';
      const PAGE_RENDER_TIMEOUT_MS=20000, PAGE_FIRST_PAINT_TIMEOUT_MS=6000, PDF_DARK_MODE_FILTER='none';
      const AlertCircle=()=>null;
      const scenario=new URLSearchParams(location.search).get('case');
      const result=window.result={calls:[],failures:[],painted:0,done:false};
      const capturePdfPageRenderFailed=(failure)=>result.failures.push(failure);
      const state={status:'loaded',scale:1,rotation:0,pageRefreshVersions:{},document:{pages:[{size:{width:24,height:32},rotation:0}]}};
      const useDocumentState=()=>state;
      let blob;
      const capability={forDocument:()=>({renderPage:(input)=>{
        result.calls.push(input);
        return {toPromise:()=>Promise.resolve(blob),abort:()=>{}};
      }})};
      const useRenderCapability=()=>({provides:capability});
      ${renderer}
      async function start(){
        const canvas=document.createElement('canvas');canvas.width=24;canvas.height=32;
        const context=canvas.getContext('2d');context.fillStyle='#09ac73';context.fillRect(0,0,24,32);
        blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        if(scenario==='helper'){
          const inline=await readPdfPageImageDataUrl(blob,new AbortController().signal);
          const copy=await fetch(inline).then(r=>r.arrayBuffer());
          result.sameBytes=String(new Uint8Array(copy))===String(new Uint8Array(await blob.arrayBuffer()));
          const controller=new AbortController();
          const reading=readPdfPageImageDataUrl(blob,controller.signal);controller.abort();
          result.cancelled=await reading.then(()=>false,error=>error.name==='AbortError');
          result.rejected=[];
          for(const invalid of [new Blob([],{type:'image/png'}),new Blob(['not an image']),new Blob([new Uint8Array(MAX_INLINE_PDF_IMAGE_BYTES+1)],{type:'image/png'})]){
            result.rejected.push(await readPdfPageImageDataUrl(invalid,new AbortController().signal).then(()=>false,()=>true));
          }
          result.done=true;return;
        }
        if(scenario==='corrupt')blob=new Blob(['invalid png'],{type:'image/png'});
        if(scenario==='blocked'||scenario==='cancel'){
          const create=URL.createObjectURL.bind(URL);
          URL.createObjectURL=(value)=>{const url=create(value);URL.revokeObjectURL(url);return url;};
        }
        const root=createRoot(document.getElementById('root'));
        if(scenario==='cancel'){
          FileReader.prototype.readAsDataURL=function(){
            // Hold encoding until the real component's cleanup cancels it.
            setTimeout(()=>{root.unmount();result.done=true;},0);
          };
        }
        const render=()=>root.render(<PageRenderLayer documentId='fixture' pageIndex={0} isPdfDarkMode={false} onRendered={()=>{result.painted++;result.done=true;}}/>);
        window.changeScale=()=>{result.done=false;state.scale=2;render();};
        render();
        new MutationObserver(()=>{if(document.querySelector('[data-ec-pdf-page-error]'))result.done=true;}).observe(document.getElementById('root'),{subtree:true,childList:true});
      }
      start().catch(error=>{result.error=String(error);result.done=true;});
    `,
  },
  bundle: true, write: false, platform: "browser", format: "iife",
  define: { "process.env.NODE_ENV": '"production"' },
});
const server = createServer((req, res) => {
  if (req.url === "/test.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end(bundle.outputFiles[0].contents);
  } else {
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<!doctype html><div id="root" style="width:240px;height:320px;position:relative"></div><script src="/test.js"></script>');
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const session = `pdf-image-${process.pid}`;
function browser(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("agent-browser", ["--session", session, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => stdout += data);
    child.stderr.on("data", data => stderr += data);
    child.on("error", reject);
    const timeout = setTimeout(() => child.kill(), 45000);
    child.on("close", code => { clearTimeout(timeout); code ? reject(new Error(stderr || stdout)) : resolve(stdout); });
    child.stdin.end(input);
  });
}
async function evaluate(expression) {
  const result = JSON.parse(await browser(["eval", "--stdin"], `JSON.stringify(${expression})`));
  return typeof result === "string" ? JSON.parse(result) : result;
}
try {
  for (const scenario of ["helper", "healthy", "blocked", "corrupt", "cancel"]) {
    await browser(["--args", "--mute-audio,--autoplay-policy=user-gesture-required", "open", `http://127.0.0.1:${server.address().port}/?case=${scenario}`]);
    await browser(["wait", "--fn", "window.result?.done"]);
    const result = await evaluate("({...window.result,inline:document.querySelector('img')?.src.startsWith('data:')})");
    assert.equal(result.error, undefined);
    if (scenario === "helper") {
      assert.equal(result.sameBytes, true);
      assert.equal(result.cancelled, true);
      assert.deepEqual(result.rejected, [true, true, true]);
    } else if (scenario === "healthy") {
      assert.equal(result.calls.length, 1);
      assert.equal(result.painted, 1);
      assert.equal(result.inline, false);
      await evaluate("(window.oldImage=document.querySelector('img'),window.changeScale(),true)");
      await browser(["wait", "--fn", "window.result.painted===2"]);
      assert.equal(await evaluate("window.oldImage.isConnected"), false);
      await evaluate("(window.oldImage.dispatchEvent(new Event('error')),true)");
      assert.equal(await evaluate("window.result.failures.length"), 0);
      assert.equal(await evaluate("window.result.calls.length"), 2);
    } else if (scenario === "blocked") {
      assert.equal(result.calls.length, 2);
      assert.equal(result.painted, 1);
      assert.equal(result.inline, true);
      assert.equal(result.failures.length, 0);
      assert.ok(result.calls[1].options.scaleFactor < result.calls[0].options.scaleFactor);
    } else if (scenario === "corrupt") {
      assert.equal(result.calls.length, 2);
      assert.equal(result.painted, 0);
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0].reason, "image_decode");
      assert.match(result.failures[0].errorMessage, /^data image, image\/png, 11 bytes$/);
    } else {
      assert.equal(result.calls.length, 2);
      assert.equal(result.painted, 0);
      assert.equal(result.failures.length, 0);
    }
    console.log(`PASS: ${scenario}`);
  }
} finally {
  await browser(["close"]).catch(() => undefined);
  await new Promise(resolve => server.close(resolve));
}
