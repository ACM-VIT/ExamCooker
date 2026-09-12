import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";
import { withCacheWriteLifetime } from "./cloudflare/cache-write-lifetime";
import { withFullRouteMissCache } from "./cloudflare/full-route-misses";

export default defineCloudflareConfig({
  incrementalCache: withCacheWriteLifetime(
    withFullRouteMissCache(withRegionalCache(r2IncrementalCache, {
      mode: "short-lived",
      bypassTagCacheOnCacheHit: false,
    })),
  ),
  queue: doQueue,
  tagCache: doShardedTagCache({
    baseShardSize: 4,
    // Route reads to the visitor's region; writes invalidate every replica.
    // In the live MAA trace, the original shard reads took 150–850 ms.
    shardReplication: {
      numberOfSoftReplicas: 1,
      numberOfHardReplicas: 1,
      regionalReplication: { defaultRegion: "apac" },
    },
    regionalCache: true,
    regionalCacheTtlSec: 5,
    // These tags describe public content only. Remote content edits can take
    // up to five seconds to become visible; sessions never use this cache.
    regionalCacheDangerouslyPersistMissingTags: true,
  }),
  // PPR must resume dynamic Suspense boundaries through the Next.js server.
  enableCacheInterception: false,
});
