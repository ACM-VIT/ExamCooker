import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];

/**
 * Keep `use cache` entries in the regional Cache API only. A regional miss
 * recomputes from Hyperdrive (~10-40 ms) instead of reading R2 (~300-400 ms
 * from the Mumbai placement). Tag checks and stale handling are unchanged.
 * Route shells still persist in R2: recomputing one is a full render.
 */
export function withRegionalOnlyDataCache(cache: IncrementalCache): IncrementalCache {
  return {
    name: cache.name,
    async get(key, cacheType) {
      return cacheType === "composable" ? null : cache.get(key, cacheType);
    },
    async set(key, value, cacheType) {
      if (cacheType !== "composable") await cache.set(key, value, cacheType);
    },
    delete: cache.delete.bind(cache),
  };
}
