import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";

// Run from the repository root. Requires the existing agent-browser CLI.
// Wall-clock values are diagnostics, not a CI threshold. Request counts and
// dependency ordering are deterministic assertions against the real warm callback.
const { values } = parseArgs({ options: {
  source: { type: "string", default: "app/components/past_papers/course-paper-card.tsx" },
  rounds: { type: "string", default: "3" },
  "allow-late-edits": { type: "boolean", default: false },
} });
const rounds = Number(values.rounds);
assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 10);
const require = createRequire(resolve("package.json"));
const ts = require("typescript-api");
const { build } = createRequire(require.resolve("wrangler/package.json"))("esbuild");
const { PDFDocument, degrees, rgb } = require("pdf-lib");
const ast = ts.createSourceFile(values.source, readFileSync(values.source, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "handleWarmPdf") callback = node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node, find);
}
find(ast);
assert.ok(callback, "Expected the paper card's real intent-preload callback");
const fixture = await PDFDocument.create();
for (const angle of [0, 90]) {
  const page = fixture.addPage([200, 300]);
  page.setRotation(degrees(angle));
  page.drawRectangle({ x: 10, y: 20, width: 30, height: 70, color: rgb(1, 0, 0) });
  page.drawRectangle({ x: 140, y: 220, width: 40, height: 60, color: rgb(0, 0, 1) });
}
const pdf = await fixture.save();
const wasmPath = readFileSync("lib/generated/pdfium-wasm.ts", "utf8").match(/"([^"]+\.wasm)"/)[1];
const wasm = readFileSync(`public${wasmPath}`);
const result = await build({
  stdin: { loader: "ts", resolveDir: process.cwd(), sourcefile: "pdf-intent-entry.ts", contents: `
    import {preloadPdfBuffer,loadPdfBuffer} from './lib/pdf/pdf-buffer-cache';
    import {preloadPdfiumEngine} from './lib/pdf/pdfium-engine-cache';
    import {normalizePdfPageEdits,preloadPdfPageEdits,applyPdfPageEditsToBuffer} from './lib/pdf/page-edits';
    const scenario=new URLSearchParams(location.search).get('case');
    const edits=scenario==='edited'?{pageOrder:[1,0],pageRotations:{'0':90,'1':180}}:null;
    const paper={fileUrl:location.origin+'/fixture.pdf',pageEdits:edits};
    const hasWarmedPdf={current:false};
    const warm=${callback};
    const result=window.result={scenario,done:false};
    const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    async function run(){
      warm();warm();
      // Hold the click at a known point after intent. This isolates the input
      // waterfall; it does not model the server or claim real-user latency.
      await new Promise(resolve=>setTimeout(resolve,300));
      result.click=performance.now();
      if(normalizePdfPageEdits(edits))preloadPdfPageEdits();
      const [engine,bytes]=await Promise.all([preloadPdfiumEngine(),loadPdfBuffer(paper.fileUrl).promise]);
      result.inputs=performance.now();
      const edited=edits?await applyPdfPageEditsToBuffer(bytes,edits):bytes;
      result.edits=performance.now();
      const document=await engine.openDocumentBuffer({id:'visible',content:edited},{normalizeRotation:true}).toPromise();
      const page=document.pages[0];
      const blob=await engine.renderPage(document,page,{rotation:page.rotation}).toPromise();
      const image=new Image();image.src=URL.createObjectURL(blob);
      window.document.body.append(image);await image.decode();await frame();await frame();
      result.visible=performance.now();
      result.dimensions=[image.naturalWidth,image.naturalHeight];
      result.rotations=document.pages.map(page=>page.rotation);
      // Validate actual PDFium pixels outside the measured critical path.
      const original=await engine.openDocumentBuffer({id:'original',content:bytes},{normalizeRotation:true}).toPromise();
      const expectedPage=original.pages[edits?1:0];
      const expectedRotation=edits?3:0;
      const [actual,expected]=await Promise.all([
        engine.renderPageRaw(document,page,{rotation:page.rotation}).toPromise(),
        engine.renderPageRaw(original,expectedPage,{rotation:expectedRotation}).toPromise(),
      ]);
      const hash=async pixels=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels.data))).join(',');
      result.pixelsMatch=actual.width===expected.width&&actual.height===expected.height&&await hash(actual)===await hash(expected);
      result.resources=performance.getEntriesByType('resource').map(entry=>({path:new URL(entry.name).pathname,start:entry.startTime,end:entry.responseEnd}));
      await engine.destroy().toPromise();URL.revokeObjectURL(image.src);result.done=true;
    }
    run().catch(error=>{result.error=String(error);result.done=true;});
  ` },
  bundle: true, splitting: true, write: false, metafile: true, outdir: "/virtual", entryNames: "entry", chunkNames: "[name]-[hash]",
  platform: "browser", format: "esm", minify: true,
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_ASSET_BASE_URL": '""' },
});
const files = new Map(result.outputFiles.map(file => [`/${basename(file.path)}`, file.contents]));
const editChunks = new Set(Object.entries(result.metafile.outputs)
  .filter(([, output]) => Object.keys(output.inputs).some(path => path.includes("/pdf-lib/")))
  .map(([path]) => `/${basename(path)}`));
assert.equal(editChunks.size, 1, "The edit library should remain one lazy chunk");
const requests = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://test").pathname;
  requests.push(path);
  let content, type, delay = 0;
  if (path === "/fixture.pdf") { content = pdf; type = "application/pdf"; delay = 100; }
  else if (path === wasmPath) { content = wasm; type = "application/wasm"; delay = 100; }
  else if (files.has(path)) { content = files.get(path); type = "text/javascript"; delay = editChunks.has(path) ? 500 : 0; }
  else if (path === "/") { content = '<!doctype html><title>PDF intent benchmark</title><script type="module" src="/entry.js"></script>'; type = "text/html"; }
  else { res.writeHead(404);res.end();return; }
  setTimeout(() => { res.writeHead(200, { "content-type": type, "cache-control": "no-store" });res.end(content); }, delay);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const session = `pdf-intent-${process.pid}`;
function browser(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("agent-browser", ["--session", session, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => stdout += data);
    child.stderr.on("data", data => stderr += data);
    child.on("error", reject);
    const timeout = setTimeout(() => child.kill(), 45000);
    child.on("close", code => { clearTimeout(timeout);code ? reject(new Error(stderr || stdout)) : resolve(stdout); });
    child.stdin.end(input);
  });
}
try {
  for (let round = 0; round < rounds; round++) {
    for (const scenario of round % 2 ? ["plain", "edited"] : ["edited", "plain"]) {
      requests.length = 0;
      await browser(["--args", "--mute-audio,--autoplay-policy=user-gesture-required", "open", `http://127.0.0.1:${server.address().port}/?case=${scenario}&round=${round}`]);
      await browser(["wait", "--fn", "window.result?.done"]);
      let measured = JSON.parse(await browser(["eval", "--stdin"], "JSON.stringify(window.result)"));
      if (typeof measured === "string") measured = JSON.parse(measured);
      assert.equal(measured.error, undefined);
      assert.equal(measured.pixelsMatch, true, "Visible page must preserve saved rotation and order");
      assert.deepEqual(measured.rotations, scenario === "edited" ? [3, 1] : [0, 1]);
      assert.equal(requests.filter(path => path === "/fixture.pdf").length, 1, "One PDF transfer per intent/open");
      assert.equal(requests.filter(path => path === wasmPath).length, 1, "One WASM transfer per intent/open");
      const editRequests = measured.resources.filter(resource => editChunks.has(resource.path));
      assert.equal(editRequests.length, scenario === "edited" ? 1 : 0, "Unedited papers must not fetch edit support");
      const editBeforeClick = editRequests[0] ? editRequests[0].start < measured.click : null;
      if (scenario === "edited" && !values["allow-late-edits"]) assert.equal(editBeforeClick, true, "Saved-edit support must start with intent, not after opening the viewer");
      console.log(JSON.stringify({ round, scenario, clickToVisibleMs: Math.round(measured.visible - measured.click), editWaitMs: Math.round(measured.edits - measured.inputs), editBeforeClick, pixelsMatch: measured.pixelsMatch, pdfTransfers: 1, wasmTransfers: 1, editTransfers: editRequests.length }));
    }
  }
} finally {
  await browser(["close"]).catch(() => undefined);
  await new Promise(resolve => server.close(resolve));
}
