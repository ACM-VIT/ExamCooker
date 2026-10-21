import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// List this build's immutable files so the production Worker can archive them
// for tabs still running the build after the next deploy (cloudflare/static-archive.ts).
// Runs after source maps are uploaded and removed.
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
}
const toUrl = (root, prefix) => file => `${prefix}/${path.relative(root, file).split(path.sep).join("/")}`;
const nextStatic = path.resolve(".next/static");
const engine = path.resolve("public/vendor/embedpdf/immutable");
const paths = [
  ...(await Promise.all(["chunks", "css", "media"].map(dir => files(path.join(nextStatic, dir))))).flat()
    .filter(file => !file.endsWith(".map")).map(toUrl(nextStatic, "/_next/static")),
  ...(await files(engine)).filter(file => file.endsWith(".wasm")).map(toUrl(engine, "/vendor/embedpdf/immutable")),
].sort();
await writeFile(path.join(nextStatic, "ec-asset-manifest.json"), JSON.stringify(paths));
console.log(`Static asset manifest: ${paths.length} files`);
