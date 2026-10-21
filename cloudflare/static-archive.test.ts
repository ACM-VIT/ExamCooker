import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { archiveCurrentAssets, archivedAssetResponse, isArchivedAssetPath, STATIC_MANIFEST_PATH } from "./static-archive";

function bucket() {
  const objects = new Map<string, { body: string; contentType?: string; customMetadata?: Record<string, string>; uploaded: Date }>();
  // Like R2, a single-part object's etag is the MD5 of its body.
  const etag = (body: string) => createHash("md5").update(body).digest("hex");
  const failPut = new Map<string, () => Promise<void>>();
  const object = (key: string) => {
    const stored = objects.get(key);
    if (!stored) return null;
    return {
      httpEtag: `"${etag(stored.body)}"`,
      etag: etag(stored.body),
      key,
      uploaded: stored.uploaded,
      customMetadata: stored.customMetadata,
      writeHttpMetadata(headers: Headers) { if (stored.contentType) headers.set("content-type", stored.contentType); },
      body: new Response(stored.body).body,
    };
  };
  const r2 = {
    async head(key: string) { return object(key); },
    async get(key: string) { return object(key); },
    async put(key: string, value: ArrayBuffer | string, options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
      onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string };
    }) {
      await failPut.get(key)?.();
      const existing = objects.get(key);
      if (options?.onlyIf?.etagDoesNotMatch === "*" && existing) return null;
      if (options?.onlyIf?.etagMatches && (!existing || etag(existing.body) !== options.onlyIf.etagMatches)) return null;
      objects.set(key, { body: typeof value === "string" ? value : new TextDecoder().decode(value), contentType: options?.httpMetadata?.contentType,
        customMetadata: options?.customMetadata, uploaded: new Date() });
      return object(key);
    },
    async delete(key: string) { objects.delete(key); },
    // Two keys per page, so callers must follow the cursor.
    async list({ prefix = "", cursor }: { prefix?: string; cursor?: string }) {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + 2);
      const truncated = start + 2 < keys.length;
      return { objects: page.map((key) => object(key)!), truncated, ...(truncated ? { cursor: String(start + 2) } : {}) };
    },
  } as unknown as R2Bucket;
  const age = (key: string, days: number) => { objects.get(key)!.uploaded = new Date(Date.now() - days * 24 * 60 * 60_000); };
  const lockExpired = (versionId: string) => Number(objects.get(`locks/${versionId}`)?.customMetadata?.expiresAt ?? 0) < Date.now();
  return { r2, objects, failPut, lockExpired, age };
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
  assert.deepEqual(first, { status: "archived", files: 2, kept: 0 });
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
  assert.deepEqual(await archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v2", origin: "https://assets.local" }), { status: "partial", files: 1, kept: 0, error: "/_next/static/chunks/gone.js: HTTP 404" });
  assert.equal(objects.has("versions/v2"), false);
  const { fetcher: noManifest } = assets({});
  assert.equal((await archiveCurrentAssets({ assets: noManifest, archive: r2, versionId: "v3", origin: "https://assets.local" })).status, "no-manifest");
});

test("concurrent isolates archive a version once; a stale lock is taken over", async () => {
  const { r2, lockExpired } = bucket();
  const files = { [STATIC_MANIFEST_PATH]: JSON.stringify(["/_next/static/chunks/a.js"]), "/_next/static/chunks/a.js": "a" };
  const { fetcher, fetched } = assets(files);
  const runs = await Promise.all([1, 2, 3].map(() => archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v4", origin: "https://assets.local" })));
  assert.equal(runs.filter((run) => run.status === "archived").length, 1);
  assert.equal(fetched.filter((path) => path === "/_next/static/chunks/a.js").length, 1);
  assert.equal(lockExpired("v4"), true, "the lock is released");

  await r2.put("locks/v5", "", { customMetadata: { expiresAt: String(Date.now() + 60_000) } });
  assert.equal((await archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v5", origin: "https://assets.local" })).status, "in-progress");
  // Isolates that read the same expired lock race to take it; one wins.
  await r2.put("locks/v5", "", { customMetadata: { expiresAt: String(Date.now() - 1) } });
  const takeovers = await Promise.all([1, 2].map(() => archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v5", origin: "https://assets.local" })));
  assert.deepEqual(takeovers.map((run) => run.status).sort(), ["archived", "in-progress"]);
});

test("a failed upload holds the lock until every other upload settles", async () => {
  const { r2, objects, failPut, lockExpired } = bucket();
  const { fetcher } = assets({
    [STATIC_MANIFEST_PATH]: JSON.stringify(["/_next/static/chunks/a.js", "/_next/static/chunks/b.js"]),
    "/_next/static/chunks/a.js": "a",
    "/_next/static/chunks/b.js": "b",
  });
  let finishB!: () => void;
  failPut.set("_next/static/chunks/a.js", async () => { throw new Error("R2 unavailable"); });
  failPut.set("_next/static/chunks/b.js", () => new Promise<void>((resolve) => { finishB = resolve; }));
  const run = archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v6", origin: "https://assets.local" });
  while (!finishB) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lockExpired("v6"), false, "b.js is still uploading");
  finishB();
  assert.deepEqual(await run, { status: "partial", files: 1, kept: 0, error: "/_next/static/chunks/a.js: R2 unavailable" });
  assert.equal(objects.get("_next/static/chunks/b.js")?.body, "b");
  assert.equal(objects.has("versions/v6"), false);
  assert.equal(lockExpired("v6"), true);
});

test("a run that outlived its lock leaves its successor's lock alone", async () => {
  const { r2, objects, failPut } = bucket();
  const { fetcher } = assets({ [STATIC_MANIFEST_PATH]: JSON.stringify(["/_next/static/chunks/a.js"]), "/_next/static/chunks/a.js": "a" });
  let finishSlow!: () => void;
  failPut.set("_next/static/chunks/a.js", () => new Promise<void>((resolve) => { finishSlow = resolve; }));
  const slow = archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v7", origin: "https://assets.local" });
  while (!finishSlow) await new Promise((resolve) => setImmediate(resolve));
  // Another isolate takes the lock over after it expired.
  failPut.delete("_next/static/chunks/a.js");
  await r2.put("locks/v7", "successor", { customMetadata: { expiresAt: String(Date.now() + 60_000) } });
  finishSlow();
  await slow;
  assert.equal(objects.get("locks/v7")?.body, "successor");
});

test("a refused lock release keeps the run's result", async () => {
  const { r2, objects, failPut, lockExpired } = bucket();
  const { fetcher } = assets({ [STATIC_MANIFEST_PATH]: JSON.stringify(["/_next/static/chunks/a.js"]), "/_next/static/chunks/a.js": "a" });
  let lockWrites = 0;
  // R2 refuses a second write to the same key within a second.
  failPut.set("locks/v8", async () => { if (++lockWrites > 1) throw new Error("429 Too Many Requests"); });
  assert.deepEqual(await archiveCurrentAssets({ assets: fetcher, archive: r2, versionId: "v8", origin: "https://assets.local" }), { status: "archived", files: 1, kept: 0 });
  assert.equal(objects.has("versions/v8"), true);
  assert.equal(lockExpired("v8"), false, "the lock stays until its TTL");
});

test("a later build copies only the files the archive lacks", async () => {
  const { r2, objects, age } = bucket();
  const chunks = ["a", "b", "c", "d"].map((name) => `/_next/static/chunks/${name}.js`);
  const files = Object.fromEntries(chunks.map((path) => [path, path]));
  const run = (versionId: string, listed: string[]) => {
    const { fetcher, fetched } = assets({ ...files, [STATIC_MANIFEST_PATH]: JSON.stringify(listed) });
    return archiveCurrentAssets({ assets: fetcher, archive: r2, versionId, origin: "https://assets.local" })
      .then((result) => ({ result, copied: fetched.filter((path) => path !== STATIC_MANIFEST_PATH) }));
  };
  assert.deepEqual(await run("v9", chunks.slice(0, 3)), { result: { status: "archived", files: 3, kept: 0 }, copied: chunks.slice(0, 3) });
  // Shared files stay; only the new chunk is copied (the listing spans pages).
  assert.deepEqual(await run("v10", [chunks[0], chunks[1], chunks[3]]), { result: { status: "archived", files: 1, kept: 2 }, copied: [chunks[3]] });

  // A file close to the bucket's 30-day expiry is uploaded again.
  age("_next/static/chunks/a.js", 21);
  assert.deepEqual(await run("v11", chunks.slice(0, 2)), { result: { status: "archived", files: 1, kept: 1 }, copied: [chunks[0]] });
  assert.ok(Date.now() - objects.get("_next/static/chunks/a.js")!.uploaded.getTime() < 60_000);

  // A version that stays live runs again once its marker's refresh time passes.
  objects.get("versions/v9")!.customMetadata = { refreshAt: String(Date.now() - 1) };
  age("_next/static/chunks/c.js", 21);
  assert.deepEqual(await run("v9", chunks.slice(0, 3)), { result: { status: "archived", files: 1, kept: 2 }, copied: [chunks[2]] });
  assert.equal((await run("v9", chunks.slice(0, 3))).result.status, "already-archived");
});

test("a version refreshes when its oldest kept file is due, not 20 days later", async () => {
  const { r2, objects, age } = bucket();
  const [x, y] = ["/_next/static/chunks/x.js", "/_next/static/chunks/y.js"];
  const run = (versionId: string, listed: string[]) => {
    const { fetcher, fetched } = assets({ [x]: "x", [y]: "y", [STATIC_MANIFEST_PATH]: JSON.stringify(listed) });
    return archiveCurrentAssets({ assets: fetcher, archive: r2, versionId, origin: "https://assets.local" })
      .then((result) => ({ result, copied: fetched.filter((path) => path !== STATIC_MANIFEST_PATH) }));
  };
  await run("v12", [x]);
  age("_next/static/chunks/x.js", 19);
  // v13 reuses the 19-day-old chunk, which R2 deletes 11 days from now.
  assert.deepEqual(await run("v13", [x, y]), { result: { status: "archived", files: 1, kept: 1 }, copied: [y] });
  const day = 24 * 60 * 60_000;
  const refreshAt = Number(objects.get("versions/v13")!.customMetadata!.refreshAt);
  assert.ok(Math.abs(refreshAt - (Date.now() + day)) < 60_000, "the marker lapses when the kept chunk turns 20 days old");
  // A marker written before refresh times existed counts as due.
  objects.get("versions/v13")!.customMetadata = {};
  age("_next/static/chunks/x.js", 20.5);
  assert.deepEqual(await run("v13", [x, y]), { result: { status: "archived", files: 1, kept: 1 }, copied: [x] });
});
