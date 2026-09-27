import assert from "node:assert/strict";
import test from "node:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import proxy, { config } from "./proxy";

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

test("ordinary pages, RSC requests and assets skip the Node proxy", () => {
  for (const url of [
    "/", "/past_papers", "/past_papers/BMAT202L",
    "/past_papers/BMAT202L?_rsc=123", "/past_papers/BMAT202L/paper/example",
    "/notes", "/notes/course/BMAT202L", "/resources", "/syllabus",
    "/signin", "/mod", "/api/auth/session", "/api/pdf-proxy",
    "/_next/static/chunks/example.js", "/_next/image?url=test",
    "/vendor/embedpdf/immutable/pdfium.wasm",
  ]) {
    assert.equal(matches(url), false, url);
  }
});

test("all create paths keep proxy coverage including trailing slashes", () => {
  for (const url of [
    "/create", "/create/", "/past_papers/create", "/past_papers/create/",
    "/notes/create", "/notes/create?from=course", "/future/nested/create",
  ]) {
    assert.equal(matches(url), true, url);
  }
});

test("native association endpoints retain their proxy responses", async () => {
  const applePath = "/.well-known/apple-app-site-association";
  const androidPath = "/.well-known/assetlinks.json";
  assert.equal(matches(applePath), true);
  assert.equal(matches(androidPath), true);
  const apple = await proxy(new NextRequest(`https://example.test${applePath}`));
  assert.equal(apple.status, 200);
  assert.equal(apple.headers.get("cache-control"), "public, max-age=3600");
  assert.equal((await apple.json()).applinks.details[0].paths[0], "*");

  const original = process.env.ANDROID_APP_LINK_SHA256;
  process.env.ANDROID_APP_LINK_SHA256 = "AA:BB:CC";
  try {
    const android = await proxy(new NextRequest(`https://example.test${androidPath}`));
    assert.equal(android.status, 200);
    assert.ok((await android.json())[0].target.sha256_cert_fingerprints.includes("AA:BB:CC"));
  } finally {
    if (original === undefined) delete process.env.ANDROID_APP_LINK_SHA256;
    else process.env.ANDROID_APP_LINK_SHA256 = original;
  }
});
