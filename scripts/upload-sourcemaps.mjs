import { readdir, readFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Run after Next's final build and before OpenNext copies or Azure packages it.
// Deployment builds opt in; ordinary local builds need no PostHog credentials.
if (process.env.POSTHOG_SOURCEMAP_UPLOAD !== "true") process.exit(0);

const directory = path.resolve(".next/static");
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
function hasMappings(map) {
  return Boolean(map.mappings?.length && map.sources?.length) || map.sections?.some(s => hasMappings(s.map));
}
const maps = (await files(directory)).filter(file => file.endsWith(".js.map"));
if (!maps.length) throw new Error("No browser source maps were generated; refusing an untraceable deployment.");
let mapped = 0;
for (const file of maps) {
  if (hasMappings(JSON.parse(await readFile(file, "utf8")))) mapped++;
}
if (!mapped) throw new Error("Browser source maps contain no mappings.");

const revision = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const build = (await readFile(".next/BUILD_ID", "utf8")).trim();
const args = ["--yes", "@posthog/cli@latest", "sourcemap", "process", "--directory", directory,
  "--release-name", "examcooker-web", "--release-version", revision, "--build", build,
  "--delete-after", "--concurrency", "3"];
await new Promise((resolve, reject) => {
  const child = spawn("npx", args, { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Source-map upload failed (${code}); deployment stopped.`)));
});
const remaining = await files(directory);
for (const file of remaining.filter(file => file.endsWith(".map"))) {
  // Turbopack also emits orphan maps for chunks removed during prerendering.
  // The CLI cannot upload those (no JS exists), but they must not be public.
  if (file.endsWith(".js.map") && remaining.includes(file.slice(0, -4))) {
    throw new Error(`A browser chunk's source map was not processed: ${path.basename(file)}`);
  }
  await unlink(file);
}
console.log(`Uploaded source maps for ${mapped} browser chunks (${revision}, build ${build}); public maps removed.`);
