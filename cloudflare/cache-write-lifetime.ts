import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];

/** Keep late streaming cache fills alive after the HTTP response completes. */
export function withCacheWriteLifetime(cache: IncrementalCache): IncrementalCache {
  return {
    name: cache.name,
    get: cache.get.bind(cache),
    delete: cache.delete.bind(cache),
    set(key, value, cacheType) {
      const pendingWrite = cache.set(key, value, cacheType);
      // Next can start new fills after it snapshots pending revalidation work.
      // Register the complete R2 + regional write with Workers at its source.
      // This extends the request lifetime without delaying the HTTP response.
      getCloudflareContext().ctx.waitUntil(pendingWrite);
      return pendingWrite;
    },
  };
}
