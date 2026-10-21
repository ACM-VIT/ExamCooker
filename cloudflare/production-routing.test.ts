import assert from "node:assert/strict";
import test from "node:test";
import { isPreviousBuildAsset, productionCompatibilityResponse } from "./production-routing";

test("authenticated requests and old rollout cookies reach the production app", () => {
  for (const path of ["/", "/api/auth/session", "/mod", "/mcp", "/past_papers/create"]) {
    const request = new Request(`https://examcooker.acmvit.in${path}`, {
      headers: { cookie: "__Secure-next-auth.session-token=session; __Host-ec-rollout=old-azure-assignment" },
    });
    assert.equal(productionCompatibilityResponse(request), null);
  }
});

test("stale Azure actions require a reload before executing on Cloudflare", () => {
  const request = new Request("https://examcooker.acmvit.in/past_papers", {
    method: "POST", headers: { "next-action": "old-action", "x-ec-document-backend": "azure" },
  });
  const response = productionCompatibilityResponse(request)!;
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("x-ec-reload"), "1");
  assert.match(response.headers.get("cache-control")!, /no-store/);
});

test("stale Azure prefetches fall back to document navigation without a reload loop", () => {
  const request = new Request("https://examcooker.acmvit.in/notes?_rsc=old", {
    headers: { rsc: "1", "next-router-prefetch": "1", "x-ec-document-backend": "azure" },
  });
  const response = productionCompatibilityResponse(request)!;
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("x-ec-reload"), null);
  assert.equal(productionCompatibilityResponse(new Request("https://examcooker.acmvit.in/notes", {
    headers: { accept: "text/html", "x-ec-document-backend": "azure" },
  })), null);
});

test("legacy hostname redirects preserve the path and query", () => {
  const response = productionCompatibilityResponse(new Request("https://exam-cooker.acmvit.in/notes?q=math"))!;
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://examcooker.acmvit.in/notes?q=math");
});

test("old rollout beacons finish without starting the Next server", () => {
  assert.equal(productionCompatibilityResponse(new Request("https://examcooker.acmvit.in/__ec_cutover/event", { method: "POST" }))?.status, 204);
});

test("previous-build fallback is limited to immutable static assets", () => {
  for (const path of ["/_next/static/chunks/old.js", "/_next/static/css/old.css", "/_next/static/media/font.woff2"]) {
    assert.equal(isPreviousBuildAsset(new Request(`https://examcooker.acmvit.in${path}`)), true);
    assert.equal(isPreviousBuildAsset(new Request(`https://examcooker.acmvit.in${path}`, { method: "POST" })), false);
  }
  for (const path of ["/api/auth/session", "/notes", "/_next/data/build/page.json", "/_next/static/chunks/private.map"]) {
    assert.equal(isPreviousBuildAsset(new Request(`https://examcooker.acmvit.in${path}`)), false);
  }
});
