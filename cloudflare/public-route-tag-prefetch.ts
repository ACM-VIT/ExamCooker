import { getCloudflareContext } from "@opennextjs/cloudflare";
import { UNTIMED_TAG_CACHE } from "./cache-timing";
import { getPublicRequestPath, publicRouteTags } from "./public-route-tags";
import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];
/** Batch public shell/data invalidation checks alongside the first cache read. */
export function withPublicRouteTagPrefetch(cache: IncrementalCache): IncrementalCache {
  const prefetches = new WeakMap<object, Promise<unknown>>();
  return {
    name: cache.name,
    get(key, cacheType) {
      let prefetch: Promise<unknown> | undefined;
      if (cacheType === "cache" && key.startsWith("/")) {
        type TagReads = { getLastRevalidated(tags: string[]): Promise<number> };
        const runtime = globalThis as typeof globalThis & {
          tagCache?: TagReads & { [UNTIMED_TAG_CACHE]?: TagReads };
          __openNextAls?: { getStore(): unknown };
        };
        // The patched adapter shares in-flight reads within this request.
        // Next still awaits the specific tags needed for each cache entry.
        if (runtime.tagCache && runtime.__openNextAls?.getStore()) {
          const { ctx } = getCloudflareContext();
          prefetch = prefetches.get(ctx);
          const pathname = getPublicRequestPath(ctx);
          const tags = pathname ? publicRouteTags(pathname) : undefined;
          if (!prefetch && tags) {
            const tagCache = runtime.tagCache[UNTIMED_TAG_CACHE] ?? runtime.tagCache;
            prefetch = tagCache.getLastRevalidated(tags).catch(() => undefined);
            prefetches.set(ctx, prefetch);
            ctx.waitUntil(prefetch);
          }
        }
      }
      // A slow data-tag shard must not hold up an unrelated shell-tag check.
      return cache.get(key, cacheType);
    },
    set: cache.set.bind(cache),
    delete: cache.delete.bind(cache),
  };
}
