import assert from "node:assert/strict";

const base = new URL(process.env.TEST_BASE_URL || "https://ec-test.acmvit.in");
assert.ok(["localhost", "127.0.0.1", "ec-test.acmvit.in"].includes(base.hostname),
  "Run this concurrency probe against a local preview or the test deployment");
const paths = ["/", "/past_papers", "/notes"];

async function render(path) {
  const started = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, path);
  const body = await response.text();
  assert.ok(body.startsWith("<!DOCTYPE html>"), `${path}: missing HTML shell`);
  assert.ok(body.includes("</body></html>"), `${path}: stream ended before completing the page`);
  assert.ok(body.length > 10000, `${path}: unexpectedly empty page`);
  assert.doesNotMatch(body, /<template[^>]*data-dgst="(?!BAILOUT_TO_CLIENT_SIDE_RENDERING)[^"]+"/,
    `${path}: server rendering failed`);
  return { path, ms: Math.round(performance.now() - started), bytes: Buffer.byteLength(body) };
}

for (const path of paths) console.log(JSON.stringify(await render(path)));
const concurrent = await Promise.all(Array.from({ length: 9 }, (_, i) => render(paths[i % paths.length])));
console.log(`PASS: nine concurrent streams complete (maximum ${Math.max(...concurrent.map(r => r.ms))} ms)`);

// Navigating away must not leave shared promises/timers that break later visitors.
await Promise.all(paths.map(async (path) => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  await response.body?.cancel();
}));
await Promise.all(paths.map(render));
console.log("PASS: subsequent pages complete after other response streams are canceled");

// Cache Components runtime prefetches may be partial, but must contain Flight
// rows. A lone partial marker hides the staged-render scheduling regression.
for (const path of ["/", "/notes", "/past_papers/BCSE102L"]) {
  const response = await fetch(new URL(path, base), {
    headers: { rsc: "1", "next-router-prefetch": "2" },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type") ?? "", /text\/x-component/);
  assert.match(await response.text(), /^[0-9a-f]+:/m, `${path}: prefetch contains no Flight rows`);
}
console.log("PASS: runtime prefetches contain rendered Flight payloads");
