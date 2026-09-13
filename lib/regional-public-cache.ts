import type { R2Bucket } from "@cloudflare/workers-types";

type PublicWrite = { value: string; expiresAt: number };
// Next can render the same data twice before a background fill reaches R2.
// Only completed public values are retained, scoped to this invocation's ctx.
const requestWrites = new WeakMap<object, Map<string, PublicWrite>>();

// These keys contain a namespace generation that changes on content edits.
// Auth, locks, feedback and mutable namespace counters must never enter here.
export function isRegionalPublicCacheKey(key: string) {
  return /^ec:past-papers-surface-cache:v\d+:n\d+:[a-f0-9]{64}$/.test(key);
}

export function createRegionalPublicCache(
  bucket: Pick<R2Bucket, "get" | "put" | "delete">,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  origin: string,
  now = Date.now,
) {
  // This factory is request-scoped. Do not share pending I/O between requests.
  const cachePromise = caches.open("examcooker-public-payloads-v1");
  let writes = requestWrites.get(ctx);
  if (!writes) requestWrites.set(ctx, writes = new Map());
  const localWrites = writes;
  const cacheKey = (key: string) => {
    if (!isRegionalPublicCacheKey(key)) throw new Error("Not a versioned public cache key");
    return new URL(`/__cache/public/${encodeURIComponent(key)}`, origin).href;
  };
  const populate = async (key: string, value: string, expiresAt: number) => {
    const ttl = Math.min(60, Math.floor((expiresAt - now()) / 1000));
    if (ttl < 1) return;
    const cache = await cachePromise;
    await cache.put(cacheKey(key), new Response(value, { headers: {
      "Cache-Control": `public, max-age=${ttl}`,
      "X-EC-Expires-At": String(expiresAt),
    } }));
  };
  return {
    async get(key: string): Promise<string | null> {
      const url = cacheKey(key);
      const local = localWrites.get(url);
      if (local && local.expiresAt > now()) return local.value;
      localWrites.delete(url);
      const cached = await cachePromise.then((cache) => cache.match(url)).catch(() => undefined);
      if (cached && Number(cached.headers.get("X-EC-Expires-At")) > now()) return cached.text();
      const object = await bucket.get(`app-state/${key}`);
      const expiresAt = Number(object?.customMetadata?.expiresAt ?? 0);
      if (!object || !Number.isFinite(expiresAt) || expiresAt <= now()) return null;
      const value = await object.text();
      ctx.waitUntil(populate(key, value, expiresAt).catch(() => undefined));
      return value;
    },
    async set(key: string, value: string, ttlSeconds: number) {
      const url = cacheKey(key);
      const expiresAt = now() + ttlSeconds * 1000;
      const entry = { value, expiresAt };
      localWrites.set(url, entry);
      try {
        await bucket.put(`app-state/${key}`, value, { customMetadata: { expiresAt: String(expiresAt) } });
      } catch (error) {
        if (localWrites.get(url) === entry) localWrites.delete(url);
        throw error;
      }
      ctx.waitUntil(populate(key, value, expiresAt).catch(() => undefined));
    },
    async del(key: string) {
      const url = cacheKey(key);
      localWrites.delete(url);
      await bucket.delete(`app-state/${key}`);
      await cachePromise.then((cache) => cache.delete(url)).catch(() => undefined);
    },
  };
}
