import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve("package.json"));
const { build } = createRequire(require.resolve("wrangler/package.json"))("esbuild");
const bundle = await build({
  stdin: { loader: "js", resolveDir: process.cwd(), contents: `
    import {installPdfOpenJourneyTracking, PDF_JOURNEY_READY_EVENT, PDF_JOURNEY_TIMEOUT_MS} from './lib/pdf/open-journey';
    const result=window.result={done:false,cases:[]};
    const A='/past_papers/TEST/paper/a', B='/past_papers/TEST/paper/b', course='/past_papers/TEST';
    const equal=(actual,expected,message)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(message+': '+JSON.stringify(actual));};
    let now=300000, hidden=false, timerId=100000;
    const timers=new Map(), nativeTimeout=window.setTimeout.bind(window), nativeClear=window.clearTimeout.bind(window);
    Object.defineProperty(performance,'now',{value:()=>now});
    Object.defineProperty(document,'visibilityState',{get:()=>hidden?'hidden':'visible',configurable:true});
    window.setTimeout=(fn,ms,...args)=>{if(ms===PDF_JOURNEY_TIMEOUT_MS){timers.set(++timerId,fn);return timerId;}return nativeTimeout(fn,ms,...args);};
    window.clearTimeout=id=>{timers.delete(id);nativeClear(id);};
    const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    const settle=async()=>{for(let i=0;i<6;i++)await frame();};
    const canvas=document.createElement('canvas');canvas.width=20;canvas.height=30;
    canvas.getContext('2d').fillRect(0,0,20,30);
    const inline=canvas.toDataURL();
    const blob=URL.createObjectURL(await new Promise(resolve=>canvas.toBlob(resolve)));
    let events=[], tracker;
    const setup=()=>{
      tracker?.dispose();document.body.replaceChildren();history.replaceState({},'',course);
      now=300000;hidden=false;events=[];
      tracker=installPdfOpenJourneyTracking({build:'test-build',backend:'cloudflare',capture:(event,properties,immediate)=>events.push({event,...properties,immediate})});
    };
    const root=(path)=>{
      const root=document.createElement('div');root.dataset.ecPdfJourneyPath=path;
      root.style.cssText='width:200px;height:200px;overflow:auto;position:relative';
      document.body.append(root);root.dispatchEvent(new Event(PDF_JOURNEY_READY_EVENT,{bubbles:true}));return root;
    };
    const image=async(root,src=blob,marked=true)=>{
      const image=new Image();image.style.cssText='display:block;width:100px;height:150px';
      if(marked)image.dataset.ecPdfPageImage='true';image.src=src;root.append(image);await image.decode();return image;
    };
    const navigate=(path,type='push')=>{tracker.start(path,type);history.pushState({},'',path);};
    const finished=()=>events.filter(event=>event.event==='pdf_open_finished');
    const pass=(name)=>{result.cases.push(name);equal(timers.size,0,name+' leaves no timer');};
    async function run(){
      setup();navigate(A);const first=root(A);now+=420;await image(first);await settle();
      equal(finished().map(event=>[event.outcome,event.duration_ms,event.image_source]),[['visible',420,'blob']],'uses the interaction clock');
      equal(events.length,2,'one started/finished pair');equal(events[0].journey_id,events[1].journey_id,'paired id');
      await image(first);first.append(document.createElement('span'));await settle();equal(events.length,2,'later pages/zoom do not repeat');pass('decoded page, fresh clock, exactly once');

      setup();navigate('/past_papers/test/paper/a');const lowercase=root(A);now+=210;await image(lowercase);await settle();
      equal(finished().map(event=>[event.outcome,event.duration_ms]),[['visible',210]],'accepted lowercase course matches canonical viewer');
      tracker.start(A,'replace');equal(events.length,2,'canonical spelling is the same paper');pass('lowercase course URL and canonical viewer');

      setup();navigate(A+'?private=secret#fragment');const recovered=root(A);now+=200;await image(recovered,inline);await settle();
      equal(finished()[0].image_source,'inline','recovery counted');equal(JSON.stringify(events).includes('secret'),false,'query not sent');equal(JSON.stringify(events).includes(A),false,'paper path not sent');pass('inline recovery and minimal event properties');

      setup();const cached=root(A);await image(cached);cached.hidden=true;await settle();
      // Browser traversal can update location before the Next hook runs.
      history.pushState({},'',A);tracker.start(A,'traverse');cached.hidden=false;cached.dispatchEvent(new Event(PDF_JOURNEY_READY_EVENT,{bubbles:true}));now+=150;await settle();
      equal(finished().map(event=>[event.outcome,event.navigation_type]),[['visible','traverse']],'cached image traversal');pass('retained page after back/forward');

      setup();navigate(A);const clipped=root(A);await image(clipped,inline,false);
      const spacer=document.createElement('div');spacer.style.height='500px';clipped.append(spacer);await image(clipped);await settle();
      equal(finished().length,0,'thumbnail and clipped image excluded');clipped.scrollTop=600;now+=800;await settle();
      equal(finished()[0].outcome,'visible','scroll into viewport');pass('thumbnails and scroll-container clipping');

      setup();navigate(A);const old=root(A);await image(old);now+=100;navigate(B);const next=root(B);await image(next);now+=250;await settle();
      equal(finished().map(event=>[event.outcome,event.duration_ms]),[['superseded',100],['visible',250]],'stale frame does not finish next journey');pass('superseded navigation and stale frames');

      setup();navigate(A);const canceled=root(A);navigate('/notes');await image(canceled);await settle();
      equal(finished().map(event=>event.outcome),['superseded'],'navigation away cancels');pass('navigation away');

      setup();navigate(A);const background=root(A);await image(background);hidden=true;document.dispatchEvent(new Event('visibilitychange'));now+=300000;hidden=false;await settle();
      equal(finished().map(event=>[event.outcome,event.immediate]),[['backgrounded',true]],'background time excluded');pass('hidden before paint');

      setup();hidden=true;navigate(A);equal(finished()[0].outcome,'backgrounded','starts hidden');pass('initially hidden attempt');

      setup();navigate(A);now+=PDF_JOURNEY_TIMEOUT_MS;[...timers.values()][0]();
      equal(finished().map(event=>[event.outcome,event.duration_ms]),[['timeout',PDF_JOURNEY_TIMEOUT_MS]],'timeout coverage');pass('timeout');

      setup();navigate(A);const failed=root(A);const error=document.createElement('div');error.dataset.ecPdfLoadError='true';error.style.cssText='width:100px;height:100px';failed.append(error);await settle();
      equal(finished()[0].outcome,'render_error','visible load error');pass('terminal viewer error');

      setup();navigate(A);window.dispatchEvent(new Event('pagehide'));equal(finished()[0].outcome,'pagehide','page left');equal(finished()[0].immediate,true,'flush on teardown');pass('pagehide');

      setup();tracker.start(course+'?sort=new#top','push');tracker.start('https://elsewhere.test'+A,'push');equal(events.length,0,'same path and external URLs ignored');
      navigate(A);tracker.start(A+'?sort=new#top','replace');equal(events.length,1,'pending same-path dispatch ignored');tracker.dispose();pass('query/hash/external navigation and cleanup');

      setup();tracker.dispose();tracker=installPdfOpenJourneyTracking({build:'test',backend:'test',capture(){throw Error('capture failure');}});navigate(A);await image(root(A));await settle();pass('capture failure cannot break the viewer');
      tracker.dispose();URL.revokeObjectURL(blob);result.done=true;
    }
    run().catch(error=>{result.error=String(error);tracker?.dispose();result.done=true;});
  ` },
  bundle: true, write: false, platform: "browser", format: "esm",
});
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": req.url === "/test.js" ? "text/javascript" : "text/html" });
  res.end(req.url === "/test.js" ? bundle.outputFiles[0].contents : '<!doctype html><title>Paper journey contracts</title><script type="module" src="/test.js"></script>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const session = `pdf-journey-${process.pid}`;
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
try {
  await browser(["--args", "--mute-audio,--autoplay-policy=user-gesture-required", "open", `http://127.0.0.1:${server.address().port}`]);
  await browser(["wait", "--fn", "window.result?.done"]);
  let result = JSON.parse(await browser(["eval", "--stdin"], "JSON.stringify(window.result)"));
  if (typeof result === "string") result = JSON.parse(result);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.cases.length, 14);
  for (const name of result.cases) console.log(`PASS: ${name}`);
} finally {
  await browser(["close"]).catch(() => undefined);
  await new Promise(resolve => server.close(resolve));
}
