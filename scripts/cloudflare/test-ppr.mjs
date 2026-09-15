import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const config = JSON.parse(await readFile(".next/required-server-files.json", "utf8")).config;
const maxState = config.experimental.maxPostponedStateSize;
assert.equal(maxState, "5mb", "Keep Next's 5x inflation cap below Workers' 128 MiB limit");
const maxOutputLength = 5 * 5 * 1024 * 1024;
const payloads = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.name.endsWith(".meta")) {
      const { postponed } = JSON.parse(await readFile(path, "utf8"));
      if (typeof postponed !== "string") continue;
      const match = /^(\d+):/.exec(postponed);
      assert.ok(match, `Invalid postponed state in ${path}`);
      const tail = postponed.slice(match[0].length + Number(match[1]));
      if (tail !== "null") payloads.push({ path, value: tail });
    }
  }
}
await scan(".next/server/app");
assert.ok(payloads.length > 0, "Build must contain PPR resume data");
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
  script: `import { inflateSync } from "node:zlib";
    export default { async fetch(request) {
      const { value, limit } = await request.json();
      const json = JSON.parse(inflateSync(Buffer.from(value, "base64"), { maxOutputLength: limit }).toString());
      return Response.json({ valid: !!json.store, entries: Object.keys(json.store.cache).length });
    }};`,
}));
try {
  for (const payload of payloads) {
    const response = await mf.dispatchFetch("http://test", {
      method: "POST", body: JSON.stringify({ value: payload.value, limit: maxOutputLength }),
    });
    assert.equal(response.status, 200, `Worker must inflate ${payload.path}`);
    assert.equal((await response.json()).valid, true);
  }
  console.log(`PASS: all ${payloads.length} built PPR resume payloads inflate and parse in Workers`);
} finally { await mf.dispose(); }
