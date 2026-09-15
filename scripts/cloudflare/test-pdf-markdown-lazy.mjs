import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = new URL(process.env.TEST_BASE_URL || "https://ec-test.acmvit.in");
assert.ok(["ec-test.acmvit.in", "localhost", "127.0.0.1"].includes(base.hostname));
const path = process.env.TEST_PDF_PATH || "/past_papers/BMAT202L/paper/e2cda739-02e8-4623-b15c-86b45c09af0e";
const expectedBuild = readFileSync(".next/BUILD_ID", "utf8").trim();
const htmlResponse = await fetch(new URL(path, base));
assert.equal(htmlResponse.status, 200);
const html = await htmlResponse.text();
const preloadLinks = (html.match(/<link\b[^>]+>/g) ?? [])
  .filter(tag => tag.includes('rel="preload"') && tag.includes('as="fetch"'));
assert.ok(preloadLinks.some(tag => tag.includes("/vendor/embedpdf/immutable/")),
  "Server HTML must start the engine download before hydration");
assert.ok(preloadLinks.some(tag => tag.includes(".pdf")),
  "Server HTML must start the PDF download before hydration");
const mathStyles = readdirSync(".next/static/chunks")
  .filter(file => file.endsWith(".css") && readFileSync(`.next/static/chunks/${file}`, "utf8").includes("KaTeX"))
  .map(file => `/_next/static/chunks/${file}`);
assert.ok(mathStyles.length > 0, "Expected the built optional math stylesheet");
const directory = mkdtempSync(join(tmpdir(), "ec-pdf-renderer-"));
const initPath = join(directory, "init.js");
const question = "Render $x^2 + y^2 = 1$. 中文测试\n\n```javascript\nconst answer = 42;\n```\n\n```mermaid\ngraph LR\n  A[Alpha] --> B[Beta]\n```";
writeFileSync(initPath, `
  window.__pdfErrors = []; window.__markdownMockCalls = 0;
  window.addEventListener('error', event => window.__pdfErrors.push(event.message));
  HTMLMediaElement.prototype.play = function() { this.muted = true; return Promise.reject(new Error('Media blocked for test')); };
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = new URL(typeof input === 'string' ? input : input.url || input, location.href);
    if (url.origin === location.origin && url.pathname === '/api/pdf/markdown') {
      window.__markdownMockCalls++;
      // The real UI renders this fixture; no generation request reaches the server.
      return Promise.resolve(new Response(JSON.stringify({type:'done', paper:{schemaVersion:'exam-questions-v1', questions:[{number:'1', text:${JSON.stringify(question)}, marks:'5'}]}, markdown:${JSON.stringify(question)}})+'\\n', {headers:{'Content-Type':'application/x-ndjson'}}));
    }
    return originalFetch.apply(this, arguments);
  };
`);
const browser = process.env.AGENT_BROWSER_BIN || "agent-browser";
const session = "ec-pdf-renderer-test";
function run(args) {
  const result = spawnSync(browser, ["--session", session, ...args], {
    encoding: "utf8", timeout: 45000, maxBuffer: 4_000_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  return result.stdout;
}
function read(expression) {
  const result = JSON.parse(run(["eval", `JSON.stringify(${expression})`]));
  return typeof result === "string" ? JSON.parse(result) : result;
}
function buttonRef(name) {
  const snapshot = run(["snapshot", "-i"]);
  const line = snapshot.split("\n").find(line => line.includes(`button "${name}"`));
  const match = line?.match(/ref=(e\d+)/);
  assert.ok(match, `Missing button: ${name}\n${snapshot}`);
  return `@${match[1]}`;
}
const pdfReady = "[...document.querySelectorAll('main img')].some(img => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 200 && img.checkVisibility())";
try {
  run(["--init-script", initPath, "--args", "--mute-audio,--autoplay-policy=user-gesture-required,--disable-extensions", "open", "about:blank"]);
  run(["eval", `setTimeout(()=>location.assign(${JSON.stringify(new URL(path, base).href)}),0);true`]);
  run(["wait", "--fn", pdfReady]);
  assert.equal(read(`document.documentElement.innerHTML.includes(${JSON.stringify(expectedBuild)})`), true);
  const before = read("performance.getEntriesByType('resource').map(entry => entry.name)");
  assert.ok(mathStyles.every(path => !before.some(url => new URL(url).pathname === path)), "Plain PDF must not fetch math CSS");
  assert.equal(read("window.__markdownMockCalls"), 0);
  assert.equal(before.filter(url => new URL(url).pathname.startsWith("/vendor/embedpdf/immutable/")).length, 1,
    "The wrapper and viewer must share one engine load");
  assert.equal(before.filter(url => new URL(url).pathname.endsWith(".pdf")).length, 1,
    "Early warming and the viewer must share one PDF download");
  const documentFetches = read("performance.getEntriesByType('resource').filter(entry => entry.name.includes('/vendor/embedpdf/immutable/') || new URL(entry.name).pathname.endsWith('.pdf')).map(entry => entry.initiatorType)");
  assert.deepEqual(documentFetches, ["link", "link"], "Both downloads must consume their HTML preloads");
  console.log("PASS: server HTML starts PDF/engine downloads; the viewer consumes each preload once");
  run(["click", buttonRef("AI Markdown actions")]);
  run(["click", buttonRef("View as Markdown")]);
  run(["wait", "--fn", "!!document.querySelector('.ec-markdown-question .katex') && [...document.querySelectorAll('.ec-markdown-question pre')].some(pre => pre.textContent.includes('const answer = 42;'))"]);
  const rendered = read(`({
    math: !!document.querySelector('.ec-markdown-question .katex'),
    mathFont: getComputedStyle(document.querySelector('.ec-markdown-question .katex')).fontFamily,
    code: [...document.querySelectorAll('.ec-markdown-question pre')].some(pre => pre.textContent.includes('const answer = 42;')),
    cjk: document.querySelector('.ec-markdown-question').textContent.includes('中文测试'),
    diagramSource: document.querySelector('.ec-markdown-question').textContent.includes('A[Alpha] --> B[Beta]'),
    calls: window.__markdownMockCalls,
    errors: window.__pdfErrors,
    resources: performance.getEntriesByType('resource').map(entry => entry.name)
  })`);
  // The existing custom pre renderer displays fenced code/diagram definitions as text.
  assert.ok(rendered.math && rendered.code && rendered.cjk && rendered.diagramSource);
  assert.match(rendered.mathFont, /KaTeX_Main/);
  assert.equal(rendered.calls, 1);
  assert.deepEqual(rendered.errors, []);
  assert.ok(mathStyles.some(path => rendered.resources.some(url => new URL(url).pathname === path)), "Text view must load its math CSS");
  run(["click", buttonRef("View PDF")]);
  run(["wait", "--fn", pdfReady]);
  console.log("PASS: plain PDF skips math CSS; requested text preserves math, code, CJK and diagram definitions; PDF return works");
  console.log("PASS: exactly one browser-only Markdown fixture response; no AI generation request sent");
} catch (error) {
  console.error(read("({calls:window.__markdownMockCalls,errors:window.__pdfErrors,text:document.querySelector('main')?.innerText.slice(0,2000),math:document.querySelectorAll('.katex').length,svgs:[...document.querySelectorAll('.ec-markdown-question svg')].map(s=>({id:s.id,text:s.textContent.slice(0,150)}))})"));
  throw error;
} finally {
  try { run(["close"]); } finally { rmSync(directory, { recursive: true, force: true }); }
}
