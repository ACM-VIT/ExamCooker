import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL(process.env.TEST_BASE_URL || "https://ec-test.acmvit.in");
assert.ok(["localhost", "127.0.0.1", "ec-test.acmvit.in"].includes(base.hostname),
  "Run revalidation probes only against a local preview or the test deployment");
// The local build must match the deployed build. Never log this revalidation token.
const { preview: { previewModeId } } = JSON.parse(await readFile(".next/prerender-manifest.json", "utf8"));
const paths = ["/", "/past_papers", "/notes", "/past_papers/BMAT202L"];

for (const method of ["HEAD", "GET"]) {
  for (const path of paths) {
    const started = performance.now();
    const response = await fetch(new URL(path, base), {
      method,
      headers: { "x-prerender-revalidate": previewModeId, "x-isr": "1" },
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.text();
    assert.equal(response.status, 200, `${method} ${path}`);
    // Next omits x-nextjs-cache when the regenerated shell retains postponed
    // state. These responses carry the explicit PPR marker instead.
    assert.ok(response.headers.get("x-nextjs-cache") === "REVALIDATED" ||
      response.headers.get("x-nextjs-postponed") === "1", `${method} ${path}: missing cache/PPR marker`);
    if (method === "GET") assert.ok(body.includes("</body></html>"), `${path}: incomplete stream`);
    console.log(JSON.stringify({ method, path, ms: Math.round(performance.now() - started) }));
  }
}
console.log("PASS: public pages finish forced cache revalidation for HEAD and GET");
