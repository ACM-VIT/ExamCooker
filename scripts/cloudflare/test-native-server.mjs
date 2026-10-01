import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { prepareNativeServer } from "./prepare-native-server.mjs";

const root = mkdtempSync(resolve(tmpdir(), "ec-native-server-"));
const generated = resolve(root, ".open-next");
const input = resolve(generated, "server-functions/default/handler.mjs");
const wasm = resolve(generated, "server-functions/default/node_modules/next/og.wasm");
const font = resolve(generated, "server-functions/default/node_modules/next/font.bin");
const entry = resolve(generated, "worker.js");
try {
  mkdirSync(resolve(generated, "server-functions/default"), { recursive: true });
  const source = `import crypto from"crypto";import wasm from${JSON.stringify(`${wasm}?module`)};
    const webpackModules={crypto:()=>"unchanged"};
    const webpackRequire=id=>webpackModules[id]();
    const value=webpackRequire("crypto");
    const builtin=require("crypto");
    const font=()=>import(${JSON.stringify(font)});
    export {value,builtin};`;
  writeFileSync(input, source);
  writeFileSync(`${input}.meta.json`, JSON.stringify({ outputs: { "handler.mjs": { imports: [
    { path: "crypto", external: true, kind: "require-call" },
    { path: "crypto", external: true, kind: "import-statement" },
    { path: `${wasm}?module`, external: true, kind: "import-statement" },
    { path: font, external: true, kind: "dynamic-import" },
  ] } } }));
  writeFileSync(entry, 'export const handler=()=>import("./server-functions/default/handler.mjs");');
  const { output } = prepareNativeServer(root);
  const first = readFileSync(output, "utf8");
  assert.match(first, /import crypto from"node:crypto"/);
  assert.match(first, /from"\.\.\/server-functions\/default\/node_modules\/next\/og\.wasm"/);
  assert.match(first, /webpackRequire\("crypto"\)/);
  assert.match(first, /builtin=require\("crypto"\)/);
  assert.match(first, /import\("\.\.\/server-functions\/default\/node_modules\/next\/font\.bin"\)/);
  assert.match(first, /createRequire\("file:\/\/\/native\/handler\.mjs"\)/);
  assert.equal(readFileSync(input, "utf8"), source, "The OpenNext server source stays untouched");
  assert.match(readFileSync(entry, "utf8"), /import\("\.\/native\/handler\.mjs"\)/);
  prepareNativeServer(root);
  assert.equal(readFileSync(output, "utf8"), first, "Repeated deploys must not accumulate transforms");
  console.log("PASS: native imports and WASM paths work without rewriting internal module IDs; packaging is repeatable");

  writeFileSync(entry, 'export const handler=()=>import("./changed-server.mjs");');
  assert.throws(() => prepareNativeServer(root), /server entry changed/);
  assert.equal(readFileSync(output, "utf8"), first);
  console.log("PASS: unexpected adapter output stops packaging before replacing the server module");
} finally {
  rmSync(root, { recursive: true, force: true });
}
