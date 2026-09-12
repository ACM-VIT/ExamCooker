import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];
const MISS_TTL_MS = 5_000;
const MAX_MISSES = 256;

/** Avoid repeated remote reads for absent full-page shells on dynamic routes. */
export function withFullRouteMissCache(cache: IncrementalCache): IncrementalCache {
  // Only timestamps live across requests: never bodies, streams or promises.
  // A remembered miss still makes Next render the page and check its data tags.
  const misses = new Map<string, number>();
  let mutationVersion = 0;
  const forget = (key: string) => {
    mutationVersion++;
    misses.delete(key);
  };
  return {
    name: cache.name,
    async get(key, cacheType) {
      const eligible = cacheType === "cache" && key.startsWith("/") && key.length <= 1024;
      if (!eligible) return cache.get(key, cacheType);
      const expiresAt = misses.get(key);
      if (expiresAt !== undefined && expiresAt > Date.now()) return null;
      misses.delete(key);
      const version = mutationVersion;
      const entry = await cache.get(key, cacheType);
      if (entry === null && version === mutationVersion) {
        if (misses.size >= MAX_MISSES) misses.delete(misses.keys().next().value!);
        misses.set(key, Date.now() + MISS_TTL_MS);
      }
      return entry;
    },
    async set(key, value, cacheType) {
      if (cacheType !== "cache") return cache.set(key, value, cacheType);
      forget(key);
      try {
        await cache.set(key, value, cacheType);
      } finally {
        // Also discard misses read while the write was in flight.
        forget(key);
      }
    },
    async delete(key) {
      forget(key);
      try {
        await cache.delete(key);
      } finally {
        forget(key);
      }
    },
  };
}
