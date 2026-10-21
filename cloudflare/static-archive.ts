// Tabs opened on an earlier build keep requesting that build's hashed files
// after a deploy removes them. Each version copies its own immutable files
// into R2 once; a request for a file the current build lacks reads it back.
// Names are content hashes, so an archived file is exactly what was requested.
export const STATIC_MANIFEST_PATH = "/_next/static/ec-asset-manifest.json";
const ARCHIVED_PATH = /^\/(?:_next\/static\/(?:chunks|css|media)\/|vendor\/embedpdf\/immutable\/)[A-Za-z0-9._~/@%+=-]+$/;
const CONCURRENCY = 8;
// An isolate that dies mid-archive leaves its lock; others may take over after this.
const LOCK_TTL_MS = 2 * 60_000;

export function isArchivedAssetPath(pathname: string) {
  return ARCHIVED_PATH.test(pathname) && !pathname.includes("..");
}

/** Serve a previous build's immutable file, or null when it was never archived. */
export async function archivedAssetResponse(request: Request, archive: R2Bucket | undefined): Promise<Response | null> {
  if (!archive || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const { pathname } = new URL(request.url);
  if (!isArchivedAssetPath(pathname)) return null;
  const object = request.method === "HEAD"
    ? await archive.head(pathname.slice(1))
    : await archive.get(pathname.slice(1));
  if (!object) return null;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);
  headers.set("x-ec-asset-source", "archive");
  return new Response("body" in object ? (object as R2ObjectBody).body : null, { headers });
}

/** Copy this version's immutable files into the archive once. */
export async function archiveCurrentAssets(input: {
  assets: Fetcher;
  archive: R2Bucket;
  versionId: string;
  origin: string;
}) {
  const marker = `versions/${input.versionId}`;
  if (await input.archive.head(marker)) return { status: "already-archived" as const, files: 0 };
  // Every isolate starts this on its first request; one at a time does the work.
  // R2 etags hash the body, so each write carries a fresh token: two isolates
  // that read the same expired lock cannot both take it over.
  const lockKey = `locks/${input.versionId}`;
  const lock = await input.archive.head(lockKey);
  const lockOptions = { customMetadata: { expiresAt: String(Date.now() + LOCK_TTL_MS) } };
  const acquired = !lock
    ? await input.archive.put(lockKey, crypto.randomUUID(), { ...lockOptions, onlyIf: { etagDoesNotMatch: "*" } })
    : Number(lock.customMetadata?.expiresAt ?? 0) < Date.now()
      ? await input.archive.put(lockKey, crypto.randomUUID(), { ...lockOptions, onlyIf: { etagMatches: lock.etag } })
      : null;
  if (!acquired) return { status: "in-progress" as const, files: 0 };
  try {
    return await copyManifestFiles(input, marker);
  } finally {
    // Expire the lock only if it is still ours; a run that outlived its TTL
    // must not release a successor's lock. R2 takes one write per second per
    // key, so a quick run's release can be refused; the lock then times out.
    await input.archive.put(lockKey, crypto.randomUUID(), {
      customMetadata: { expiresAt: "0" },
      onlyIf: { etagMatches: acquired.etag },
    }).catch(() => undefined);
  }
}

async function copyManifestFiles(input: Parameters<typeof archiveCurrentAssets>[0], marker: string) {
  const manifest = await input.assets.fetch(new Request(`${input.origin}${STATIC_MANIFEST_PATH}`));
  if (!manifest.ok) return { status: "no-manifest" as const, files: 0 };
  const paths = (await manifest.json() as string[]).filter(isArchivedAssetPath);
  let next = 0;
  let failed = 0;
  // Re-put every file so a still-current file's lifecycle age restarts.
  // A failed file is counted, not thrown: the lock must outlive every upload.
  const copy = async (path: string) => {
    const response = await input.assets.fetch(new Request(`${input.origin}${path}`));
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    // R2 needs a known length; these files are small and immutable.
    await input.archive.put(path.slice(1), await response.arrayBuffer(), {
      httpMetadata: { contentType: response.headers.get("content-type") ?? "application/octet-stream" },
    });
    return true;
  };
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next++];
      if (!(await copy(path).catch(() => false))) failed++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Leave the marker unset after failures so the next run retries.
  if (failed === 0) await input.archive.put(marker, JSON.stringify({ files: paths.length }));
  return { status: failed === 0 ? "archived" as const : "partial" as const, files: paths.length - failed };
}
