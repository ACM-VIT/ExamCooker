import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

function readRedisEnv() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();

  return { token, url };
}

export function getOptionalRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const { token, url } = readRedisEnv();
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    token,
    url,
  });

  return redisClient;
}
