import { getCloudflareContext } from "@opennextjs/cloudflare";
import { COURSE_PATH, getCourseRequestPath } from "./course-request-path";
import type { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

type IncrementalCache = Parameters<typeof withRegionalCache>[0];
const COURSE_TAGS = ["courses", "notes", "past_papers", "syllabus", "upcoming_exams"];

function getCourseShellTags(key: string) {
  const root = "/(app)/past_papers/[code]";
  const exam = key.split("/").length > 3;
  return [
    "_N_T_/layout",
    "_N_T_/(app)/layout",
    "_N_T_/(app)/past_papers/layout",
    `_N_T_${root}/layout`,
    ...(exam ? [`_N_T_${root}/[exam]/layout`] : []),
    `_N_T_${root}${exam ? "/[exam]" : ""}/page`,
  ];
}

/** Overlap both shell and course-data tag checks with the initial cache read. */
export function withCourseTagPrefetch(cache: IncrementalCache): IncrementalCache {
  const prefetches = new WeakMap<object, Promise<unknown>>();
  return {
    name: cache.name,
    get(key, cacheType) {
      let prefetch: Promise<unknown> | undefined;
      if (cacheType === "cache" && COURSE_PATH.test(key)) {
        const runtime = globalThis as typeof globalThis & {
          tagCache?: { getLastRevalidated(tags: string[]): Promise<number> };
          __openNextAls?: { getStore(): unknown };
        };
        // The adapter stores resolved tag metadata in OpenNext's request cache.
        // Later normal checks reuse it; their invalidation decisions are intact.
        if (runtime.tagCache && runtime.__openNextAls?.getStore()) {
          const { ctx } = getCloudflareContext();
          prefetch = prefetches.get(ctx);
          if (!prefetch) {
            const pathname = getCourseRequestPath(ctx);
            prefetch = runtime.tagCache.getLastRevalidated([
              ...COURSE_TAGS, ...getCourseShellTags(key),
              ...(pathname ? [`_N_T_${pathname}`] : []),
            ]).catch(() => undefined);
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
