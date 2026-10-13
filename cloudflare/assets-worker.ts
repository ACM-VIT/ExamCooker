import { createHash, timingSafeEqual } from "node:crypto";

const SOURCE = "https://examcookerprodsi.blob.core.windows.net/exam-assets/";
const SOURCE_RESOURCE = "/subscriptions/b88416d5-3d98-4d1c-bd30-8df01b99dfac/resourceGroups/rg-examcooker-prod/providers/Microsoft.Storage/storageAccounts/examcookerprodsi";
const MAX_BYTES = 256 * 1024 * 1024;
const CACHE_SECONDS = 60;
type Env = { BUCKET: R2Bucket; MIRROR_TOKEN: string };
type ByteRange = { offset: number; length: number };

function parseRange(header: string, size: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const offset = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || offset >= size || end < offset) return null;
  return { offset, length: end - offset + 1 };
}

function conditionStatus(request: Request, object: R2Object): number | null {
  const matches = (value: string | null, weak = false) => value?.split(",").some(tag => {
    const normalized = weak ? tag.trim().replace(/^W\//, "") : tag.trim();
    return normalized === "*" || normalized === object.httpEtag;
  });
  if (request.headers.has("if-match") && !matches(request.headers.get("if-match"))) return 412;
  const unmodified = Date.parse(request.headers.get("if-unmodified-since") || "");
  if (!request.headers.has("if-match") && Number.isFinite(unmodified) && Math.floor(object.uploaded.getTime() / 1000) > unmodified / 1000) return 412;
  if (matches(request.headers.get("if-none-match"), true)) return 304;
  const modified = Date.parse(request.headers.get("if-modified-since") || "");
  if (!request.headers.has("if-none-match") && Number.isFinite(modified) && Math.floor(object.uploaded.getTime() / 1000) <= modified / 1000) return 304;
  return null;
}

function validKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 &&
    !/[\\\x00-\x1f\x7f]/.test(value) &&
    value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

function sourceUrl(key: string) {
  return SOURCE + key.split("/").map(encodeURIComponent).join("/");
}

function keyFromSource(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(SOURCE)) return null;
  try {
    const url = new URL(value);
    if (url.search || url.hash) return null;
    const key = decodeURIComponent(url.pathname.slice("/exam-assets/".length));
    return validKey(key) && new URL(sourceUrl(key)).href === url.href ? key : null;
  } catch { return null; }
}

function authorized(request: Request, env: Env) {
  const token = Buffer.from(request.headers.get("x-ec-mirror-token") || "");
  const expected = Buffer.from(env.MIRROR_TOKEN || "");
  return expected.length > 0 && token.length === expected.length && timingSafeEqual(token, expected);
}

const error = (status: number) => new Response("Asset unavailable", {
  status, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
});

// Copying and checksum calculation use a bounded stream. File bytes never pass
// through the migration operator's laptop or accumulate in Worker memory.
export async function mirrorObject(
  bucket: R2Bucket,
  key: string,
  expected?: { etag?: string; size?: number },
  allowDelete = false,
) {
  if (!validKey(key)) throw new Error("Invalid object key");
  const existing = await bucket.head(key);
  const response = await fetch(sourceUrl(key), {
    // Worker subrequests can cache Azure's response. Replication must observe
    // the current blob, including overwrites and deletions reported by events.
    cache: "no-store",
    redirect: "manual", signal: AbortSignal.timeout(25_000),
    headers: { "accept-encoding": "identity", ...(expected?.etag ? { "if-match": `"${expected.etag.replaceAll('"', '')}"` } : {}) },
  });
  // ETags cannot distinguish metadata-only updates. uploadedBefore is exclusive;
  // allow the observed millisecond, using R2's subsecond comparison. Keys remain
  // present as tombstones on deletion, so an old write cannot recreate a gap.
  const condition = existing
    ? { uploadedBefore: new Date(existing.uploaded.getTime() + 1), secondsGranularity: false }
    : { etagDoesNotMatch: "*" };
  if (response.status === 404) {
    await response.body?.cancel();
    if (allowDelete && existing) {
      // A conditional tombstone prevents a delayed delete notification from
      // silently overwriting a simultaneous upload. Conflicts are retried.
      const deleted = await bucket.put(key, null, {
        onlyIf: condition, customMetadata: { azureDeleted: "true" },
      });
      if (!deleted) throw new Error("Concurrent mirror change");
    }
    return { key, status: "missing" };
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Azure returned ${response.status}`);
  }
  const size = Number(response.headers.get("content-length"));
  const etag = response.headers.get("etag")?.replaceAll('"', '');
  if (!etag || !response.headers.has("content-length") ||
      (response.headers.has("content-encoding") && response.headers.get("content-encoding") !== "identity") ||
      !Number.isSafeInteger(size) || size < 0 || size > MAX_BYTES ||
      (expected?.size !== undefined && expected.size !== size)) {
    await response.body.cancel();
    throw new Error("Invalid source metadata");
  }
  if (existing?.customMetadata?.azureEtag === etag && existing.size === size) {
    await response.body.cancel();
    return { key, status: "unchanged", size, etag, md5: existing.etag };
  }
  const md5 = createHash("md5");
  const sha256 = createHash("sha256");
  const stream = new FixedLengthStream(size);
  const pump = response.body.pipeThrough(new TransformStream({
    transform(chunk, output) { md5.update(chunk); sha256.update(chunk); output.enqueue(chunk); },
  })).pipeTo(stream.writable);
  const sourceMd5 = response.headers.get("content-md5");
  const [stored] = await Promise.all([
    bucket.put(key, stream.readable, {
      onlyIf: condition,
      httpMetadata: {
        contentType: response.headers.get("content-type") || "application/octet-stream",
        cacheControl: response.headers.get("cache-control") || "public, max-age=60",
        ...(response.headers.get("content-disposition") ? { contentDisposition: response.headers.get("content-disposition")! } : {}),
        ...(response.headers.get("content-language") ? { contentLanguage: response.headers.get("content-language")! } : {}),
      },
      customMetadata: {
        ...Object.fromEntries([...response.headers].filter(([name]) => name.startsWith("x-ms-meta-")).map(([name, value]) => [name.slice(10), value])),
        azureEtag: etag,
        azureLastModified: response.headers.get("last-modified") || "",
      },
      ...(sourceMd5 ? { md5: Uint8Array.from(atob(sourceMd5), c => c.charCodeAt(0)).buffer } : {}),
    }),
    pump,
  ]);
  if (!stored) throw new Error("Concurrent mirror change");
  const checksum = md5.digest("hex");
  if (stored.size !== size || stored.etag !== checksum) throw new Error("Mirror checksum mismatch");
  return { key, status: "copied", size, etag, md5: checksum, sha256: sha256.digest("hex") };
}

async function admin(request: Request, env: Env) {
  if (!authorized(request, env)) return error(401);
  if (request.method !== "POST") return error(405);
  const text = await request.text();
  if (text.length > 64 * 1024) return error(413);
  const input = JSON.parse(text);
  if (new URL(request.url).pathname === "/_mirror") {
    if (input.operation === "list") {
      const result = await env.BUCKET.list({ cursor: input.cursor, limit: 1000, include: ["httpMetadata", "customMetadata"] });
      return Response.json(result);
    }
    if (!validKey(input.key)) return error(400);
    if (input.operation === "head") return Response.json(await env.BUCKET.head(input.key));
    return Response.json(await mirrorObject(env.BUCKET, input.key, input.expected));
  }
  if (!Array.isArray(input) || input.length > 10) return error(400);
  for (const event of input) {
    if (event.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent") {
      return Response.json({ validationResponse: event.data?.validationCode });
    }
    if (event.topic?.toLowerCase() !== SOURCE_RESOURCE.toLowerCase() ||
        !["Microsoft.Storage.BlobCreated", "Microsoft.Storage.BlobDeleted"].includes(event.eventType)) return error(400);
    const key = keyFromSource(event.data?.url);
    if (!key) return error(400);
    // Always read the current Azure object: events can arrive out of order.
    await mirrorObject(env.BUCKET, key, undefined, true);
  }
  return new Response(null, { status: 204 });
}

async function serve(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "Range, If-None-Match, If-Modified-Since", "access-control-max-age": "86400",
  } });
  if (request.method !== "GET" && request.method !== "HEAD") return error(405);
  const url = new URL(request.url);
  let key: string;
  try { key = decodeURIComponent(url.pathname.slice(1)); } catch { return error(400); }
  if (!validKey(key) || url.search) return error(404);
  const cacheKey = new Request(url.href);
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cacheable = request.method === "GET" &&
    !["range", "if-none-match", "if-modified-since", "if-match", "if-unmodified-since"].some(name => request.headers.has(name));
  if (cacheable && !/no-cache|no-store|max-age=0/.test(request.headers.get("cache-control") || "")) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set("x-ec-asset-cache", "HIT");
      return response;
    }
  }
  let range: ByteRange | undefined;
  let invalidRangeSize: number | undefined;
  const get = async (): Promise<R2Object | R2ObjectBody | null> => {
    if (request.method === "HEAD") return env.BUCKET.head(key);
    if (request.headers.has("range")) {
      const metadata = await env.BUCKET.head(key);
      if (!metadata) return null;
      if (conditionStatus(request, metadata)) return metadata;
      const ifRange = request.headers.get("if-range");
      if (!ifRange || ifRange === metadata.httpEtag || Date.parse(ifRange) >= Math.floor(metadata.uploaded.getTime() / 1000) * 1000) {
        const parsed = parseRange(request.headers.get("range")!, metadata.size);
        if (!parsed) { invalidRangeSize = metadata.size; return metadata; }
        range = parsed;
      }
    }
    return env.BUCKET.get(key, { ...(range ? { range } : {}), onlyIf: request.headers });
  };
  let object = await get();
  if (!object) {
    const result = await mirrorObject(env.BUCKET, key);
    if (result.status === "missing") return error(404);
    object = await get();
  }
  if (!object || object.customMetadata?.azureDeleted === "true") return error(404);
  if (invalidRangeSize !== undefined) return new Response(null, { status: 416, headers: {
    "content-range": `bytes */${invalidRangeSize}`, "cache-control": "no-store", "access-control-allow-origin": "*",
  } });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("last-modified", object.uploaded.toUTCString());
  headers.set("cache-control", `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-expose-headers", "Content-Length, Content-Range, ETag, X-EC-Asset-Source, X-EC-Asset-Cache");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("timing-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");
  headers.set("accept-ranges", "bytes");
  headers.set("x-ec-asset-source", "r2");
  headers.set("x-ec-asset-cache", "MISS");
  const condition = conditionStatus(request, object);
  if (condition) {
    if ("body" in object) void (object as R2ObjectBody).body.cancel();
    return new Response(null, { status: condition, headers });
  }
  if (range) {
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("content-length", String(range.length));
  } else headers.set("content-length", String(object.size));
  const response = new Response("body" in object ? (object as R2ObjectBody).body : null, { status: range ? 206 : 200, headers });
  // A tee can buffer the faster branch while a mobile download stalls. Keep
  // large documents streaming directly from R2 within the isolate memory limit.
  if (cacheable && response.status === 200 && object.size <= 8 * 1024 * 1024) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
  }
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const path = new URL(request.url).pathname;
      return await (path === "/_mirror" || path === "/_events" ? admin(request, env) : serve(request, env, ctx));
    } catch (cause) {
      console.error("[asset-delivery]", cause instanceof Error ? cause.message : "Asset request failed");
      return error(503);
    }
  },
};
