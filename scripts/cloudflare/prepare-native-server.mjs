import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Preserve OpenNext's server as a separate Worker module, outside the entry bundle. */
export function prepareNativeServer(root = process.cwd()) {
  const generated = resolve(root, ".open-next");
  const input = resolve(generated, "server-functions/default/handler.mjs");
  const output = resolve(generated, "native/handler.mjs");
  const entryPath = resolve(generated, "worker.js");
  const metadata = JSON.parse(readFileSync(`${input}.meta.json`, "utf8"));
  const originalEntry = readFileSync(entryPath, "utf8");
  const originalImport = 'import("./server-functions/default/handler.mjs")';
  const nativeImport = 'import("./native/handler.mjs")';
  assert.ok(originalEntry.includes(originalImport) || originalEntry.includes(nativeImport),
    "OpenNext's server entry changed; review native module packaging before deploying");

  let source = readFileSync(input, "utf8");
  const imports = Object.values(metadata.outputs).flatMap((item) => item.imports);
  const replacements = new Set();
  for (const item of imports) {
    if (!item.external || replacements.has(item.path)) continue;
    let target = item.path;
    if (isAbsolute(target)) {
      const file = target.replace(/\?module$/, "");
      assert.ok(file.startsWith(`${generated}/`), `Unexpected external file: ${file}`);
      target = relative(dirname(output), file).split("\\").join("/");
      if (!target.startsWith(".")) target = `./${target}`;
    } else if (["import-statement", "dynamic-import"].includes(item.kind) && isBuiltin(target) && !target.startsWith("node:")) {
      target = `node:${target}`;
    }
    if (target === item.path) continue;
    const quoted = JSON.stringify(item.path);
    const replacement = JSON.stringify(target);
    // Change only ESM import specifiers. Replacing every matching string also
    // changes Next's internal Webpack module IDs (for example, "crypto").
    let updated = source
      .replaceAll(`from${quoted}`, `from${replacement}`)
      .replaceAll(`import(${quoted})`, `import(${replacement})`);
    if (isAbsolute(item.path)) {
      updated = updated.replaceAll(`require(${quoted})`, `require(${replacement})`);
    }
    if (updated === source) {
      throw new Error(`Unsupported external import syntax: ${item.path}`);
    }
    source = updated;
    replacements.add(item.path);
  }

  // Wrangler normally injects these when it bundles the server into worker.js.
  // Workers does not populate import.meta.url, so require needs a stable base.
  const globals = [
    'import { createRequire } from "node:module";',
    'import { Buffer } from "node:buffer";',
    'import process from "node:process";',
    'const require = createRequire("file:///native/handler.mjs");',
  ].join("\n");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${globals}\n${source}`);
  writeFileSync(entryPath, originalEntry.replace(originalImport, nativeImport));
  return { output, imports: replacements.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = prepareNativeServer();
  console.log(`Prepared separate Next server module (${result.imports} external imports)`);
}
