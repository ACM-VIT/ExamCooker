import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";
import { withIncrementalCacheTiming, withTagCacheTiming } from "./cloudflare/cache-timing";
import { withCacheWriteLifetime } from "./cloudflare/cache-write-lifetime";
import { withFullRouteMissCache } from "./cloudflare/full-route-misses";
import { withPublicRouteTagPrefetch } from "./cloudflare/public-route-tag-prefetch";
import { withRegionalOnlyDataCache } from "./cloudflare/regional-data-cache";

const config = defineCloudflareConfig({
  incrementalCache: withIncrementalCacheTiming(withPublicRouteTagPrefetch(withCacheWriteLifetime(
    withFullRouteMissCache(withRegionalCache(withRegionalOnlyDataCache(r2IncrementalCache), {
      // Keep local copies for their revalidation lifetime instead of expiring
      // every minute. Next still checks tags and serves/revalidates stale data.
      mode: "long-lived",
      bypassTagCacheOnCacheHit: false,
    })),
  ))),
  queue: doQueue,
  tagCache: withTagCacheTiming(doShardedTagCache({
    baseShardSize: 4,
    // No regional replicas: every request runs in the ap-south-1 placement,
    // so replicas chosen by the visitor's continent only added a round trip
    // to another continent. Objects are created next to the placed Worker.
    shardReplication: {
      numberOfSoftReplicas: 1,
      numberOfHardReplicas: 1,
    },
    regionalCache: true,
    regionalCacheTtlSec: 5,
    // These tags describe public content only. Remote content edits can take
    // up to five seconds to become visible; sessions never use this cache.
    regionalCacheDangerouslyPersistMissingTags: true,
  })),
  // PPR must resume dynamic Suspense boundaries through the Next.js server.
  enableCacheInterception: false,
});

// This target-specific alias must also apply when invoking the adapter directly.
config.buildCommand = "EC_CLOUDFLARE_BUILD=1 pnpm build --turbopack && node scripts/upload-sourcemaps.mjs && node scripts/static-asset-manifest.mjs";

export default config;
