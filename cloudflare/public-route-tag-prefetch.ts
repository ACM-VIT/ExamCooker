import { getCloudflareContext } from "@opennextjs/cloudflare";
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
        const runtime = globalThis as typeof globalThis & {
          tagCache?: { getLastRevalidated(tags: string[]): Promise<number> };
          __openNextAls?: { getStore(): unknown };
        };
        // The adapter stores resolved tag metadata in OpenNext's request cache.
        // Later normal checks reuse it; their invalidation decisions are intact.
        if (runtime.tagCache && runtime.__openNextAls?.getStore()) {
          const { ctx } = getCloudflareContext();
          prefetch = prefetches.get(ctx);
          const pathname = getPublicRequestPath(ctx);
          const tags = pathname ? publicRouteTags(pathname) : undefined;
          if (!prefetch && tags) {
            prefetch = runtime.tagCache.getLastRevalidated(tags).catch(() => undefined);
            prefetches.set(ctx, prefetch);
            ctx.waitUntil(prefetch);
          }
        }
      }
      const entry = cache.get(key, cacheType);
      if (!prefetch) return entry;
      return entry.then(async (value) => {
        // Next must validate a hit before serving it. If the local shell arrives
        // first, let the in-flight tag read finish rather than duplicate its RPCs.
        if (value) await prefetch;
        return value;
      });
    },
    set: cache.set.bind(cache),
    delete: cache.delete.bind(cache),
  };
}
