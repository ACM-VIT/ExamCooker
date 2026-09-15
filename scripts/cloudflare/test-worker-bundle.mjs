import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const root = ".open-next/server-functions/default";
const meta = JSON.parse(await readFile(`${root}/handler.mjs.meta.json`, "utf8"));
const config = JSON.parse(await readFile(".next/required-server-files.json", "utf8")).config;
assert.equal(config.turbopack.resolveAlias["@/lib/redis"], "./cloudflare/redis-unavailable.ts",
  "Build with pnpm cf:build to apply the Cloudflare backend alias");

// Next has already bundled dependencies into opaque chunk names by this stage.
// Inspect their source maps too, so duplicated SDK copies cannot hide in chunks.
const sources = new Set(Object.keys(meta.inputs));
function collect(map) {
  for (const source of map.sources ?? []) sources.add(decodeURIComponent(source));
  for (const section of map.sections ?? []) collect(section.map);
}
let maps = 0;
for (const input of Object.keys(meta.inputs)) {
  const marker = input.indexOf("/.next/server/");
  if (marker === -1 || !input.endsWith(".js")) continue;
  const mapPath = `${input.slice(marker + 1)}.map`;
  if (!await stat(mapPath).catch(() => null)) continue;
  collect(JSON.parse(await readFile(mapPath, "utf8")));
  maps++;
}
assert.ok(maps > 0, "Expected source maps for the bundled Next server chunks");
const redis = [...sources].filter(source => /\/node_modules\/(?:redis|@redis\/[^/]+)(?:\/|$)/.test(source));
assert.deepEqual(redis, [], "Worker must not load the unused Node Redis/Entra SDKs");
const handler = await readFile(`${root}/handler.mjs`);
console.log(`PASS: ${maps} server source maps contain no Redis SDK; handler ${handler.length} bytes / ${gzipSync(handler).length} gzip bytes`);
