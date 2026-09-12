import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");

const { outputFiles } = await build({
  stdin: { contents: `
    import { AppState } from "./cloudflare/app-state.ts";
    import { protectPersonalizedResponse } from "./cloudflare/cache-policy.ts";
    import { stateObjectName } from "./lib/app-state-types.ts";
    export { AppState };
    export default { async fetch(request, env) {
      if (new URL(request.url).pathname === "/state") {
        const op = await request.json();
        return Response.json(await env.APP_STATE.getByName(stateObjectName(op.key)).execute(op));
      }
      const response = new Response("test", { headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": request.headers.get("test-content-type") || "application/javascript",
        ...(request.headers.has("test-set-cookie") ? { "Set-Cookie": "session=test; HttpOnly" } : {})
      }});
      return protectPersonalizedResponse(request, response);
    }};`, resolveDir: resolve(".") },
  bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers"],
});
const mf = new Miniflare(convertV4MiniflareOptions({ name: "app-state-test",
  modules: true, script: outputFiles[0].text, compatibilityDate: "2026-09-10",
  durableObjects: { APP_STATE: { className: "AppState", useSQLite: true } },
}));
const op = async (operation) => {
  const response = await mf.dispatchFetch("http://test/state", {
    method: "POST", body: JSON.stringify(operation),
  });
  assert.equal(response.status, 200);
  return response.json();
};
try {
  const locks = await Promise.all(Array.from({ length: 30 }, (_, i) =>
    op({ type: "set", key: "lock", value: String(i), ex: 60, nx: true })));
  assert.equal(locks.filter((value) => value === "OK").length, 1);
  const owner = await op({ type: "get", key: "lock" });
  assert.equal(await op({ type: "releaseLock", key: "lock", token: "stale-owner" }), 0);
  assert.equal(await op({ type: "get", key: "lock" }), owner);
  assert.equal(await op({ type: "releaseLock", key: "lock", token: owner }), 1);
  console.log("PASS: concurrent lock acquisition and owner-only release");

  const limits = await Promise.all(Array.from({ length: 40 }, () =>
    op({ type: "slidingWindow", key: "rate-limit", now: Date.now(), windowMs: 1000, limit: 10 })));
  assert.equal(limits.filter(([allowed]) => allowed === 1).length, 10);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.deepEqual(await op({ type: "slidingWindow", key: "rate-limit", now: Date.now(), windowMs: 1000, limit: 10 }), [1, 1]);
  console.log("PASS: global sliding-window limit under contention and expiry");

  const feedbackKey = "ec:pdf-markdown:feedback:paper:generation";
  const vote = (user, value) => op({ type: "recordVote", key: `ec:pdf-markdown:vote:paper:generation:${user}`,
    feedbackKey, vote: value, updatedAt: new Date().toISOString(), ttlSeconds: 60 });
  await Promise.all(Array.from({ length: 30 }, (_, i) => vote(`voter${i}`, "up")));
  await Promise.all(Array.from({ length: 20 }, () => vote("voter0", "up")));
  const totals = () => op({ type: "hgetall", key: feedbackKey });
  assert.equal((await totals()).upvotes, 30);
  await vote("voter0", "down");
  assert.equal((await totals()).upvotes, 29);
  assert.equal((await totals()).downvotes, 1);
  assert.equal(await op({ type: "get", key: "ec:pdf-markdown:vote:paper:generation:voter1" }), "up");
  assert.equal(await op({ type: "get", key: "ec:pdf-markdown:vote:paper:generation:voter0" }), "down");
  console.log("PASS: concurrent vote totals, duplicate votes, vote changes, and per-user isolation");

  await op({ type: "set", key: "expires", value: "old", ex: 1, nx: true });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(await op({ type: "get", key: "expires" }), null);
  assert.equal(await op({ type: "set", key: "expires", value: "new", ex: 30, nx: true }), "OK");
  assert.equal(await op({ type: "releaseLock", key: "expires", token: "old" }), 0);
  console.log("PASS: expired lock replacement cannot be released by old owner");

  for (const [path, headers] of [
    ["/", { "test-content-type": "text/html" }],
    ["/api/auth/session", {}], ["/api/auth/csrf", {}], ["/auth", {}],
    ["/mod", {}], ["/native-auth/browser-complete", {}],
    ["/papers", { cookie: "__Secure-next-auth.session-token.0=userA" }],
    ["/papers", { authorization: "Bearer userB" }],
    ["/papers", { rsc: "1" }], ["/redirect", { "test-set-cookie": "1" }],
  ]) {
    const response = await mf.dispatchFetch(`http://test${path}`, { headers });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
    if (headers["test-set-cookie"]) assert.ok(response.headers.has("set-cookie"));
  }
  const staticResponse = await mf.dispatchFetch("http://test/_next/static/chunk.js");
  assert.match(staticResponse.headers.get("cache-control"), /immutable/);
  console.log("PASS: auth, cookies (including chunks), bearer tokens, RSC and HTML bypass shared HTTP caching; static assets remain cacheable");
} finally {
  await mf.dispose();
}
