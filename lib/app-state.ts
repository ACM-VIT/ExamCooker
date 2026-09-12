import "server-only";

import { randomUUID } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";
import { getOptionalRedis, type AppRedisClient } from "@/lib/redis";
import { RECORD_FEEDBACK_SCRIPT, RELEASE_LOCK_SCRIPT, SLIDING_WINDOW_SCRIPT } from "@/lib/app-state-scripts";
import { isCachePayload, stateObjectName, type StateOperation } from "@/lib/app-state-types";
import { createRegionalPublicCache, isRegionalPublicCacheKey } from "@/lib/regional-public-cache";

export interface AppStateClient extends Omit<AppRedisClient, "eval"> {
  releaseLock(key: string, token: string): Promise<number>;
  slidingWindow(key: string, now: number, windowMs: number, limit: number): Promise<[number, number]>;
  recordVote(key: string, feedbackKey: string, vote: "up" | "down", updatedAt: string, ttlSeconds: number): Promise<[string, string, string]>;
}

type StateBindings = {
  APP_CACHE_BUCKET: R2Bucket;
  APP_STATE: {
    getByName(name: string): { execute(operation: StateOperation): Promise<unknown> };
  };
};

function cloudflareClient(): AppStateClient {
  // Resolve bindings inside the current request. Never retain request I/O in a
  // module-level promise or Durable Object stub across Worker invocations.
  const { env, ctx } = getCloudflareContext();
  const { APP_CACHE_BUCKET: bucket, APP_STATE: state } = env as unknown as StateBindings;
  if (!bucket || !state) throw new Error("Cloudflare application state bindings are missing");
  const execute = <T>(operation: StateOperation) =>
    state.getByName(stateObjectName(operation.key)).execute(operation) as Promise<T>;
  const objectKey = (key: string) => `app-state/${key}`;
  let regionalCache: ReturnType<typeof createRegionalPublicCache> | undefined;
  const publicCache = () => regionalCache ??= createRegionalPublicCache(
    bucket, ctx, process.env.NEXT_PUBLIC_BASE_URL || "https://examcooker.acmvit.in",
  );

  return {
    async get<T>(key: string): Promise<T | null> {
      if (!isCachePayload(key)) return execute<T | null>({ type: "get", key });
      if (isRegionalPublicCacheKey(key)) return await publicCache().get(key) as T | null;
      const object = await bucket.get(objectKey(key));
      if (!object || Number(object.customMetadata?.expiresAt ?? 0) <= Date.now()) return null;
      return await object.text() as T;
    },
    async set(key, value, options) {
      if (!isCachePayload(key)) return execute({ type: "set", key, value, ...options });
      // Only immutable/public payloads live in R2. Locks and votes always use DOs.
      if (options?.nx) throw new Error("Conditional cache writes require AppState locks");
      if (!options?.ex) throw new Error("Cached payloads require an expiry");
      if (isRegionalPublicCacheKey(key)) {
        await publicCache().set(key, value, options.ex);
        return "OK";
      }
      await bucket.put(objectKey(key), value, {
        customMetadata: { expiresAt: String(Date.now() + options.ex * 1000) },
      });
      return "OK";
    },
    async del(key) {
      if (!isCachePayload(key)) return execute({ type: "del", key });
      if (isRegionalPublicCacheKey(key)) {
        await publicCache().del(key);
        return 1;
      }
      await bucket.delete(objectKey(key));
      return 1;
    },
    hgetall: (key) => execute({ type: "hgetall", key }),
    incr: (key) => execute({ type: "incr", key }),
    releaseLock: (key, token) => execute({ type: "releaseLock", key, token }),
    slidingWindow: (key, now, windowMs, limit) => execute({ type: "slidingWindow", key, now, windowMs, limit }),
    recordVote: (key, feedbackKey, vote, updatedAt, ttlSeconds) =>
      execute({ type: "recordVote", key, feedbackKey, vote, updatedAt, ttlSeconds }),
  };
}

export function getOptionalAppState(): AppStateClient | null {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return cloudflareClient();
  }
  // Keep the existing Azure/Node deployment operational until production cutover.
  const redis = getOptionalRedis();
  if (!redis) return null;
  return {
    ...redis,
    releaseLock: (key, token) => redis.eval(RELEASE_LOCK_SCRIPT, [key], [token]),
    slidingWindow: (key, now, windowMs, limit) => redis.eval(SLIDING_WINDOW_SCRIPT, [key],
      [String(now), String(windowMs), String(limit), `${now}:${randomUUID()}`]),
    recordVote: (key, feedbackKey, vote, updatedAt, ttlSeconds) =>
      redis.eval(RECORD_FEEDBACK_SCRIPT, [key, feedbackKey], [vote, updatedAt, String(ttlSeconds)]),
  };
}
