import assert from "node:assert/strict";
import test from "node:test";
import { archiveCurrentAssets, archivedAssetResponse, isArchivedAssetPath, STATIC_MANIFEST_PATH } from "./static-archive";

function bucket() {
  const objects = new Map<string, { body: string; contentType?: string }>();
  const object = (key: string) => {
    const stored = objects.get(key);
    if (!stored) return null;
    return {
      httpEtag: `"${key}"`,
      writeHttpMetadata(headers: Headers) { if (stored.contentType) headers.set("content-type", stored.contentType); },
      body: new Response(stored.body).body,
    };
  };
  const r2 = {
    async head(key: string) { return object(key); },
    async get(key: string) { return object(key); },
    async put(key: string, value: ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }) {
      objects.set(key, { body: typeof value === "string" ? value : new TextDecoder().decode(value), contentType: options?.httpMetadata?.contentType });
    },
  } as unknown as R2Bucket;
  return { r2, objects };
}

function assets(files: Record<string, string>) {
  const fetched: string[] = [];
  const fetcher = {
    async fetch(request: Request) {
      const { pathname } = new URL(request.url);
      fetched.push(pathname);
      return pathname in files
        ? new Response(files[pathname], { headers: { "content-type": pathname.endsWith(".json") ? "application/json" : "text/javascript" } })
        : new Response("missing", { status: 404 });
    },
  } as unknown as Fetcher;
  return { fetcher, fetched };
}

test("only hashed static files and the PDF engine are archived paths", () => {
  for (const path of ["/_next/static/chunks/0abc.js", "/_next/static/media/font.woff2", "/_next/static/css/x.css", "/vendor/embedpdf/immutable/abc.wasm"]) {
    assert.equal(isArchivedAssetPath(path), true, path);
  }
  for (const path of ["/_next/static/BUILD_ID/_buildManifest.js", "/api/auth/session", "/past_papers", "/_next/static/chunks/../secret", STATIC_MANIFEST_PATH]) {
    assert.equal(isArchivedAssetPath(path), false, path);
  }
});

test("a version archives its manifest once, then serves files a later build lacks", async () => {
  const { r2, objects } = bucket();
  const { fetcher, fetched } = assets({
    [STATIC_MANIFEST_PATH]: JSON.stringify(["/_next/static/chunks/old.js", "/vendor/embedpdf/immutable/e.wasm"]),
    "/_next/static/chunks/old.js": "old chunk",
    "/vendor/embedpdf/immutable/e.wasm": "engine",
  });
  const first = await archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v1", origin: "https://assets.local" });
  assert.deepEqual(first, { status: "archived", files: 2 });
  assert.equal(objects.get("_next/static/chunks/old.js")?.contentType, "text/javascript");
  const again = await archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v1", origin: "https://assets.local" });
  assert.equal(again.status, "already-archived");
  assert.equal(fetched.filter((path) => path === STATIC_MANIFEST_PATH).length, 1);

  const response = (await archivedAssetResponse(new Request("https://examcooker.acmvit.in/_next/static/chunks/old.js"), r2))!;
  assert.equal(await response.text(), "old chunk");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("x-ec-asset-source"), "archive");
  assert.equal(await archivedAssetResponse(new Request("https://examcooker.acmvit.in/_next/static/chunks/never.js"), r2), null);
  assert.equal(await archivedAssetResponse(new Request("https://examcooker.acmvit.in/_next/static/chunks/old.js", { method: "POST" }), r2), null);
  assert.equal(await archivedAssetResponse(new Request("https://examcooker.acmvit.in/_next/static/chunks/old.js"), undefined), null);
});

test("a partial archive leaves the version unmarked so the next run retries", async () => {
  const { r2, objects } = bucket();
  const { fetcher } = assets({ [STATIC_MANIFEST_PATH]: JSON.stringify(["/_next/static/chunks/a.js", "/_next/static/chunks/gone.js"]), "/_next/static/chunks/a.js": "a" });
  assert.deepEqual(await archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v2", origin: "https://assets.local" }), { status: "partial", files: 1 });
  assert.equal(objects.has("versions/v2"), false);
  const { fetcher: noManifest } = assets({});
  assert.equal((await archiveCurrentAssets({ assets: noManifest, archive: r2, versionId: "v3", origin: "https://assets.local" })).status, "no-manifest");
});
