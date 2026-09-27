import test from "node:test";
import assert from "node:assert/strict";
import { chooseBackend, hasSession, originUrl, routeLabel } from "./policy";
import { sign, verify } from "./tokens";

function request(path = "/past_papers/BMAT202L", headers: Record<string, string> = {}, method = "GET") {
  return new Request(`https://examcooker.acmvit.in${path}`, { method, headers: { accept: "text/html", ...headers } });
}
test("5% assignment has an exact boundary and stays sticky", () => {
  assert.equal(chooseBackend(request(), null, 5, 0.04999), "cloudflare");
  assert.equal(chooseBackend(request(), null, 5, 0.05), "azure");
  assert.equal(chooseBackend(request(), "cloudflare", 5, 0.99), "cloudflare");
  assert.equal(chooseBackend(request(), "azure", 5, 0), "azure");
});
test("all authenticated and protected requests remain Azure", () => {
  for (const cookie of ["__Secure-next-auth.session-token=x", "__Secure-next-auth.session-token.0=x", "next-auth.session-token=x", "authjs.session-token=x"]) {
    assert.ok(hasSession(request("/", { cookie })));
    assert.equal(chooseBackend(request("/", { cookie }), "cloudflare", 100, 0), "azure");
  }
  assert.equal(chooseBackend(request("/", { authorization: "Bearer x" }), "cloudflare", 100, 0), "azure");
  for (const path of ["/api/auth/session", "/api/uploads", "/auth", "/mod/papers/review", "/native-auth/start/google", "/past_papers/create", "/mcp", "/notes/create"]) {
    assert.equal(chooseBackend(request(path), "cloudflare", 100, 0), "azure", path);
  }
});
test("old tabs, prefetches, static requests, bots and actions never enroll", () => {
  for (const req of [request("/", { rsc: "1" }), request("/", { "sec-purpose": "prefetch;prerender", "sec-fetch-dest": "document" }), request("/", { "next-router-prefetch": "1" }), request("/?_rsc=x"), request("/_next/static/chunks/12345678.js", { accept: "*/*" }), request("/", { "user-agent": "Googlebot" }), request("/", { "next-action": "abc" }, "POST")]) {
    assert.equal(chooseBackend(req, null, 100, 0), "azure");
  }
  assert.equal(chooseBackend(request("/past_papers/BMAT202L", { rsc: "1" }), "cloudflare", 5, 0.9), "cloudflare");
});
test("zero percent overrides existing canary cookies", () => {
  assert.equal(chooseBackend(request(), "cloudflare", 0, 0), "azure");
});
test("signed cookies cannot be forged or reused with another key", async () => {
  const value = { backend: "cloudflare", id: "session" };
  const token = await sign(value, "test-key");
  assert.deepEqual(await verify(token, "test-key"), value);
  assert.equal(await verify(token, "wrong-key"), null);
  assert.equal(await verify(token.replace(/^./, "x"), "test-key"), null);
  assert.equal(await verify("not-a-token", "test-key"), null);
});
test("telemetry groups papers without storing document IDs", () => {
  assert.equal(routeLabel("/past_papers/BMEE209L/paper/private-id"), "/past_papers/[course]/paper/[id]");
});
test("a double-slash path cannot change the upstream origin", () => {
  const input = new URL("https://examcooker.acmvit.in//example.com/path?q=1");
  const result = originUrl(input);
  assert.equal(result.origin, "https://examcooker.acmvit.in");
  assert.equal(result.pathname, "//example.com/path");
  assert.equal(result.search, "?q=1");
});
