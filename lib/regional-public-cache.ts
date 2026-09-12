import type { R2Bucket } from "@cloudflare/workers-types";

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
      cacheKey(key);
      const expiresAt = now() + ttlSeconds * 1000;
      await bucket.put(`app-state/${key}`, value, { customMetadata: { expiresAt: String(expiresAt) } });
      ctx.waitUntil(populate(key, value, expiresAt).catch(() => undefined));
    },
    async del(key: string) {
      const url = cacheKey(key);
      await bucket.delete(`app-state/${key}`);
      await cachePromise.then((cache) => cache.delete(url)).catch(() => undefined);
    },
  };
}
