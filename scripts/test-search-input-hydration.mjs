import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const { build } = createRequire(import.meta.resolve("wrangler/package.json"))("esbuild");
// Use a real browser: a DOM mock cannot reproduce hydration's preservation of
// native input values or subsequent React-controlled input updates.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
      import React, { useState, useRef, useEffect } from "react";
      import { hydrateRoot } from "react-dom/client";
      import { usePreserveSearchInput } from "./lib/use-preserve-search-input";
      function Fixture({ preserve }) {
        const [query, setQuery] = useState("");
        const [open, setOpen] = useState(false);
        const [tick, setTick] = useState(0);
        const inputRef = useRef(null);
        const absentRef = useRef(null);
        usePreserveSearchInput(preserve ? inputRef : absentRef, setQuery, setOpen);
        // Model the unrelated client initialization that triggers a re-render.
        useEffect(() => { setTick(1); }, []);
        useEffect(() => { window.fixtureState = { query, open, tick }; }, [query, open, tick]);
        return <><input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} />
          <output>{query}</output><span>{tick}</span></>;
      }
      window.hydrate = preserve => hydrateRoot(document.getElementById("root"), <Fixture preserve={preserve} />);
    `,
  },
  bundle: true,
  write: false,
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
});

const server = createServer((request, response) => {
  if (request.url === "/bundle.js") {
    response.setHeader("content-type", "application/javascript");
    response.end(bundle.outputFiles[0].text);
  } else {
    response.setHeader("content-type", "text/html");
    response.end('<!doctype html><html><body><div id="root"><input value=""><output></output><span>0</span></div><script src="/bundle.js"></script></body></html>');
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = process.env.AGENT_BROWSER_BIN || "agent-browser";
const run = async args => (await promisify(execFile)(browser,
  ["--session", "ec-search-hydration-test", ...args],
  { timeout: 30000, maxBuffer: 2_000_000 },
)).stdout;
async function read(expression) {
  const result = JSON.parse(await run(["eval", `JSON.stringify(${expression})`]));
  return typeof result === "string" ? JSON.parse(result) : result;
}

try {
  for (const preserve of [false, true]) {
    await run(["--args", "--mute-audio,--autoplay-policy=user-gesture-required",
      "open", `http://127.0.0.1:${server.address().port}/`]);
    await run(["snapshot", "-i"]);
    await run(["fill", "input", "BMAT202L"]);
    await run(["eval", `window.hydrate(${preserve});true`]);
    await run(["wait", "--fn", "window.fixtureState?.tick===1"]);
    const hydrated = await read('({state:window.fixtureState,value:document.querySelector("input").value})');
    assert.equal(hydrated.value, preserve ? "BMAT202L" : "");
    assert.equal(hydrated.state.query, preserve ? "BMAT202L" : "");
    if (preserve) {
      assert.equal(hydrated.state.open, true);
      await run(["press", "End"]);
      await run(["press", "x"]);
      assert.equal((await read("window.fixtureState")).query, "BMAT202Lx");
      // Real key events verify normal editing after the initial adoption.
      for (let i = 0; i < 9; i++) await run(["press", "Backspace"]);
      assert.equal((await read("window.fixtureState")).query, "");
    }
    console.log(preserve
      ? "PASS: early text survives hydration, opens results, and supports editing/clearing"
      : "PASS: control reproduces lost pre-hydration text");
  }
} finally {
  try { await run(["close"]); } finally { server.close(); }
}
