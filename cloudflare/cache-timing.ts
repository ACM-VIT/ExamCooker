import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import { timeRequestWork } from "./request-timing";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];
type TagCacheReads = {
  getLastRevalidated(tags: string[]): Promise<number>;
  hasBeenRevalidated(tags: string[], lastModified?: number): Promise<boolean>;
  isStale?(tags: string[], lastModified?: number): Promise<boolean>;
};

/** Attribute route-shell and data-cache reads to the request waiting on them. */
export function withIncrementalCacheTiming(cache: IncrementalCache): IncrementalCache {
  return {
    name: cache.name,
    get(key, cacheType) {
      const kind = cacheType === "cache" ? "routeCache" : "dataCache";
      return timeRequestWork(getCloudflareContext().ctx, kind, () => cache.get(key, cacheType));
    },
    set: cache.set.bind(cache),
    delete: cache.delete.bind(cache),
  };
}

/** Attribute tag invalidation reads; writes and other members pass through unchanged. */
export function withTagCacheTiming<T extends TagCacheReads>(tagCache: T): T {
  const reads = new Set<PropertyKey>(["getLastRevalidated", "hasBeenRevalidated", "isStale"]);
  return new Proxy(tagCache, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      // Bind to the original instance: the adapter keeps state in private fields.
      const method = value.bind(target);
      if (!reads.has(property)) return method;
      return (...args: unknown[]) => timeRequestWork(getCloudflareContext().ctx, "tags", () => method(...args));
    },
  });
}
