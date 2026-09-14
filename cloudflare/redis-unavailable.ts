import "server-only";
import type { AppRedisClient } from "../lib/redis";

export type { AppRedisClient, RedisSetOptions } from "../lib/redis";

// Cloudflare requests use AppState bindings before reaching the Redis fallback.
// Build-time prerendering has no Worker context and runs without a Redis cache.
export function getOptionalRedis(): AppRedisClient | null {
  return null;
}
