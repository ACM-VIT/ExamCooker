import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];
const COURSE_TAGS = ["courses", "notes", "past_papers", "syllabus", "upcoming_exams"];
const COURSE_SHELL = /^\/past_papers\/(?:\[code\]|[a-z]{2,6}\d{3}[a-z]?)(?:\/(?:\[exam\]|cat1|cat2|fat))?$/i;

/** Overlap course data-tag checks with the initial PPR shell lookup. */
export function withCourseTagPrefetch(cache: IncrementalCache): IncrementalCache {
  const started = new WeakSet<object>();
  return {
    name: cache.name,
    get(key, cacheType) {
      if (cacheType === "cache" && COURSE_SHELL.test(key)) {
        const runtime = globalThis as typeof globalThis & {
          tagCache?: { getLastRevalidated(tags: string[]): Promise<number> };
          __openNextAls?: { getStore(): unknown };
        };
        // The adapter stores resolved tag metadata in OpenNext's request cache.
        // Later normal checks reuse it; their invalidation decisions are intact.
        if (runtime.tagCache && runtime.__openNextAls?.getStore()) {
          const { ctx } = getCloudflareContext();
          if (!started.has(ctx)) {
            started.add(ctx);
            ctx.waitUntil(runtime.tagCache.getLastRevalidated(COURSE_TAGS).catch(() => undefined));
          }
        }
      }
      return cache.get(key, cacheType);
    },
    set: cache.set.bind(cache),
    delete: cache.delete.bind(cache),
  };
}
